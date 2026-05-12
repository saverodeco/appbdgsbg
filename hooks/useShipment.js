import { supabase } from '../supabase/client';

export const addItemToTruck = async ({ truckNo, soNumber, soItem, quantity, plant }) => {
  try {
    const { error: insertError } = await supabase.from('fg_loading').insert([
      {
        truck_no: truckNo,
        so_number: soNumber,
        so_item: soItem,
        quantity: parseInt(quantity, 10),
        plant,
        status: 'Loading',
      },
    ]);
    if (insertError) throw insertError;

    // Recalculate and update the delivery schedule
    await updateDeliveryQuantityFromLoading({ soNumber, soItem });

    return { success: true, message: 'Item added to truck successfully.' };
  } catch (error) {
    return { success: false, message: `Error adding item: ${error.message}` };
  }
};

export const deleteItemFromTruck = async ({ itemId, soNumber, soItem }) => {
  try {
    const { error: deleteError } = await supabase
      .from('fg_loading')
      .delete()
      .eq('id', itemId);

    if (deleteError) throw deleteError;

    // Recalculate and update the delivery schedule
    await updateDeliveryQuantityFromLoading({ soNumber, soItem });

    return { success: true, message: 'Item deleted successfully.' };
  } catch (error) {
    return { success: false, message: `Error deleting item: ${error.message}` };
  }
};

export const cancelItemGroup = async ({ truckNo, soNumber, soItem }) => {
  try {
    const { error: deleteError } = await supabase
      .from('fg_loading')
      .delete()
      .eq('truck_no', truckNo)
      .eq('so_number', soNumber)
      .eq('so_item', soItem);

    if (deleteError) throw deleteError;

    // After cancelling, reset the delivery schedule status
    const { error: updateError } = await supabase
      .from('fg_delivery_schedule')
      .update({ delivery_status: 'Scheduled', delivery_quantity: 0 })
      .eq('so_number', soNumber)
      .eq('so_item', soItem);

    if (updateError) throw updateError;

    return { success: true, message: `Items for SO ${soNumber} on truck ${truckNo} cancelled.` };
  } catch (error) {
    return { success: false, message: `Error cancelling items: ${error.message}` };
  }
};


export const finalizeShipment = async (session, plant, truckNo) => {
  try {
    // 1. Fetch all 'Loading' items for the given truck and plant
    const { data: itemsToFinalize, error: fetchError } = await supabase
      .from('fg_loading')
      .select('*')
      .eq('truck_no', truckNo)
      .eq('plant', plant)
      .eq('status', 'Loading');

    if (fetchError) throw fetchError;

    if (itemsToFinalize.length === 0) {
      return { success: true, message: 'No items to finalize.' };
    }

    // 2. Create stock movements
    const stockMovements = itemsToFinalize.map(item => {
      const { id, created_at, status, ...movementData } = item;
      return {
        ...movementData,
        movement_type: '601',
        user_id: session?.user?.id,
        lmg_number: `LMG-${item.truck_no}-${item.id}`,
        initial_loc: item.plant,
        destination_loc: 'Customer',
      };
    });

    const { error: insertError } = await supabase
      .from('fg_stock_movements')
      .insert(stockMovements);

    if (insertError) throw insertError;

    // 3. Update status in fg_loading to 'Finish Loading'
    const { error: updateLoadingError } = await supabase
      .from('fg_loading')
      .update({ status: 'Finish Loading' })
      .in('id', itemsToFinalize.map(item => item.id));

    if (updateLoadingError) throw updateLoadingError;

    // 4. Aggregate quantities for each SO item
    const quantityUpdates = itemsToFinalize.reduce((acc, item) => {
      const key = `${item.so_number}-${item.so_item}`;
      if (!acc[key]) {
        acc[key] = { so_number: item.so_number, so_item: item.so_item, quantity: 0 };
      }
      acc[key].quantity += item.quantity;
      return acc;
    }, {});

    // 5. Process each aggregated item to update delivery schedules
    const processScheduleUpdates = async () => {
      for (const update of Object.values(quantityUpdates)) {
        const shippedQty = update.quantity;

        // Fetch the original open schedule item
        const { data: schedules, error: scheduleError } = await supabase
          .from('fg_delivery_schedule')
          .select('*')
          .eq('so_number', update.so_number)
          .eq('so_item', update.so_item)
          .in('delivery_status', ['Scheduled', 'Loading', 'PartialCarryover']) // Find the active schedule line
          .order('id', { ascending: true })
          .limit(1);

        if (scheduleError) throw scheduleError;
        if (!schedules || schedules.length === 0) {
          throw new Error(`No active schedule found for SO ${update.so_number}-${update.so_item}.`);
        }
        const originalSchedule = schedules[0];

        // Update the original schedule to 'Shipped'
        const { error: updateError } = await supabase
          .from('fg_delivery_schedule')
          .update({
            delivery_status: 'Shipped',
            delivery_quantity: shippedQty,
            user_name: session?.user?.email,
            truck_no: truckNo,
          })
          .eq('id', originalSchedule.id);

        if (updateError) throw updateError;

        // If it's a partial shipment, create a new 'PartialCarryover' schedule
        if (shippedQty < originalSchedule.outstanding_qty) {
          // Exclude unique/generated fields for the new record
          const { id, created_at, delivery_status, delivery_quantity, outstanding_qty, ...carryoverData } = originalSchedule;
          const newOutstandingQty = originalSchedule.outstanding_qty - shippedQty;

          const { error: carryoverError } = await supabase
            .from('fg_delivery_schedule')
            .insert([{
              ...carryoverData,
              outstanding_qty: newOutstandingQty,
              delivery_status: 'PartialCarryover',
            }]);

          if (carryoverError) throw carryoverError;
        }
      }
    };

    await processScheduleUpdates();

    return { success: true, message: `Shipment for truck ${truckNo} finalized.` };

  } catch (error) {
    return { success: false, message: `Error finalizing shipment: ${error.message}` };
  }
};


// Helper function to update delivery quantity from fg_loading data
const updateDeliveryQuantityFromLoading = async ({ soNumber, soItem }) => {
  // 1. Calculate the total loaded quantity from fg_loading
  const { data: loadingData, error: loadingError } = await supabase
    .from('fg_loading')
    .select('quantity')
    .eq('so_number', soNumber)
    .eq('so_item', soItem)
    .eq('status', 'Loading');

  if (loadingError) throw loadingError;

  const totalLoadedQuantity = loadingData.reduce((sum, item) => sum + item.quantity, 0);

  // 2. Determine the new status
  const newStatus = totalLoadedQuantity > 0 ? 'Loading' : 'Scheduled';

  // 3. Update the corresponding delivery schedule item
  const { error: updateError } = await supabase
    .from('fg_delivery_schedule')
    .update({
      delivery_quantity: totalLoadedQuantity,
      delivery_status: newStatus,
    })
    .eq('so_number', soNumber)
    .eq('so_item', soItem)
    .in('delivery_status', ['Scheduled', 'Loading', 'PartialCarryover']); // Only update active schedules

  if (updateError) throw updateError;
};
