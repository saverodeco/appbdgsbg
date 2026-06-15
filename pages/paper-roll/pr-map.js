
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase/client';

export default function InventorySummary({ plant }) {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'kind', direction: 'ascending' });

  useEffect(() => {
    const fetchAndSummarizeData = async () => {
      setLoading(true);
      try {
        let query = supabase.from('pr_stock').select('*');

        if (plant) {
          query = query.eq('plant', plant);
        }

        const { data: rolls, error } = await query;

        if (error) {
          console.error('Error fetching rolls:', error);
          setSummary([]);
        } else {
          const processedSummary = processSummary(rolls);
          setSummary(processedSummary);
        }
      } catch (error) {
        console.error('Error fetching rolls:', error);
      } finally {
        setLoading(false);
      }
    };

    if (plant) {
      fetchAndSummarizeData();
    } else {
      setSummary([]);
      setLoading(false);
    }
  }, [plant]);

  const processSummary = (rolls) => {
    const today = new Date();
    const rollsWithAging = rolls.map(roll => {
        const receiveDate = roll.goods_receive_date ? new Date(roll.goods_receive_date) : null;
        const aging = receiveDate ? Math.floor((today - receiveDate) / (1000 * 60 * 60 * 24)) : 0;
        return { ...roll, aging };
    });

    const groupedByKindGsmWidth = rollsWithAging.reduce((acc, roll) => {
        const key = `${roll.kind}-${roll.gsm}-${roll.width}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(roll);
        return acc;
    }, {});

    const summaryData = Object.values(groupedByKindGsmWidth).map(group => {
        const firstRoll = group[0];
        const oldBatch = {
            rolls: group.filter(r => r.batch === 'OLD'),
            numRolls: 0,
            totalWeight: 0,
            maxAging: 0,
            binLocationOfMaxAging: ''
        };
        const localBatch = {
            rolls: group.filter(r => r.batch !== 'OLD'),
            numRolls: 0,
            totalWeight: 0,
            maxAging: 0,
            binLocationOfMaxAging: ''
        };

        if (oldBatch.rolls.length > 0) {
            oldBatch.numRolls = oldBatch.rolls.length;
            oldBatch.totalWeight = oldBatch.rolls.reduce((sum, r) => sum + r.weight, 0);
            const maxAgingRoll = oldBatch.rolls.reduce((max, r) => r.aging > max.aging ? r : max, oldBatch.rolls[0]);
            oldBatch.maxAging = maxAgingRoll.aging;
            oldBatch.binLocationOfMaxAging = maxAgingRoll.bin_location;
        }

        if (localBatch.rolls.length > 0) {
            localBatch.numRolls = localBatch.rolls.length;
            localBatch.totalWeight = localBatch.rolls.reduce((sum, r) => sum + r.weight, 0);
            const maxAgingRoll = localBatch.rolls.reduce((max, r) => r.aging > max.aging ? r : max, localBatch.rolls[0]);
            localBatch.maxAging = maxAgingRoll.aging;
            localBatch.binLocationOfMaxAging = maxAgingRoll.bin_location;
        }

        return {
            kind: firstRoll.kind,
            gsm: firstRoll.gsm,
            width: firstRoll.width,
            oldBatch,
            localBatch
        };
    });

    return summaryData;
  };

  const sortedSummary = useMemo(() => {
    let sortableItems = [...summary];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const keys = sortConfig.key.split('.');
        let aValue = a;
        let bValue = b;
        for (let key of keys) {
            aValue = aValue[key];
            bValue = bValue[key];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [summary, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getOldBatchColor = (numRolls) => {
    if (numRolls > 2) return 'red';
    if (numRolls === 2) return 'yellow';
    return 'green';
  };

  const getLocalBatchColor = (numRolls) => {
    if (numRolls >= 10 && numRolls <= 20) return 'green';
    return 'yellow';
  };

  if (loading) {
    return <div>Loading summary...</div>;
  }

  return (
    <div>
      <h1>Inventory Summary</h1>
      <table>
        <thead>
          <tr>
            <th rowSpan="2" onClick={() => requestSort('kind')}>Kind</th>
            <th rowSpan="2" onClick={() => requestSort('gsm')}>GSM</th>
            <th rowSpan="2" onClick={() => requestSort('width')}>Width</th>
            <th colSpan="4">Batch OLD</th>
            <th colSpan="4">Batch LOCAL</th>
          </tr>
          <tr>
            <th onClick={() => requestSort('oldBatch.numRolls')}>Roll</th>
            <th onClick={() => requestSort('oldBatch.totalWeight')}>Weight</th>
            <th onClick={() => requestSort('oldBatch.maxAging')}>Max Aging</th>
            <th onClick={() => requestSort('oldBatch.binLocationOfMaxAging')}>Max Bin Location</th>
            <th onClick={() => requestSort('localBatch.numRolls')}>Roll</th>
            <th onClick={() => requestSort('localBatch.totalWeight')}> Weight</th>
            <th onClick={() => requestSort('localBatch.maxAging')}>Max Aging</th>
            <th onClick={() => requestSort('localBatch.binLocationOfMaxAging')}>Max Bin Location</th>
          </tr>
        </thead>
        <tbody>
          {sortedSummary.map((item, index) => (
            <tr key={index}>
              <td>{item.kind}</td>
              <td>{item.gsm}</td>
              <td>{item.width}</td>
              <td style={{ backgroundColor: getOldBatchColor(item.oldBatch.numRolls) }}>{item.oldBatch.numRolls}</td>
              <td>{item.oldBatch.totalWeight.toFixed(2)}</td>
              <td>{item.oldBatch.maxAging}</td>
              <td>{item.oldBatch.binLocationOfMaxAging}</td>
              <td style={{ backgroundColor: getLocalBatchColor(item.localBatch.numRolls) }}>{item.localBatch.numRolls}</td>
              <td>{item.localBatch.totalWeight.toFixed(2)}</td>
              <td>{item.localBatch.maxAging}</td>
              <td>{item.localBatch.binLocationOfMaxAging}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
