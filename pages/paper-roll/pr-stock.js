
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase/client';
import { formatDate } from '../../utils/dateFormatter';

const ITEMS_PER_PAGE = 500;

export default function Inventory({ plant }) {
  const [rolls, setRolls] = useState([]);
  const [kindAndGsmSearch, setKindAndGsmSearch] = useState('');
  const [widthSearch, setWidthSearch] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [rollIdSearch, setRollIdSearch] = useState('');
  const [binLocationSearch, setBinLocationSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'goods_receive_date', direction: 'ascending' });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchRolls = async () => {
      setLoading(true);
      try {
        let query = supabase.from('pr_stock').select('*');

        if (plant) {
          query = query.eq('plant', plant);
        }

        const { data: rollsList, error } = await query;

        if (error) {
          console.error('Error fetching rolls:', error);
          setRolls([]);
        } else {
          setRolls(rollsList);
        }
      } catch (error) {
        console.error('Error fetching rolls:', error);
      } finally {
        setLoading(false);
      }
    };
    if(plant){
        fetchRolls();
    } else {
        setRolls([]);
        setLoading(false);
    }
  }, [plant]);

  const sortedAndFilteredRolls = useMemo(() => {
    let filtered = rolls.map(roll => {
        const today = new Date();
        const receiveDate = roll.goods_receive_date ? new Date(roll.goods_receive_date) : null;
        const aging = receiveDate ? Math.floor((today - receiveDate) / (1000 * 60 * 60 * 24)) : null;
        return { ...roll, aging };
    }).filter(roll => {
      const kind = roll.kind || '';
      const gsm = roll.gsm ? roll.gsm.toString() : '';
      const width = roll.width ? roll.width.toString() : '';
      const batch = roll.batch || '';
      const rollId = roll.roll_id || '';
      const binLocation = roll.bin_location || '';
      
      const searchTerm = kindAndGsmSearch.toLowerCase();
      const searchKind = searchTerm.replace(/[^a-z]/gi, '');
      const searchGsm = searchTerm.replace(/[^0-9]/g, '');

      const kindMatch = kind.toLowerCase().includes(searchKind);
      const gsmMatch = gsm.toLowerCase().includes(searchGsm);

      return (
        kindMatch &&
        gsmMatch &&
        width.toLowerCase().includes(widthSearch.toLowerCase()) &&
        batch.toLowerCase().includes(batchSearch.toLowerCase()) &&
        rollId.toLowerCase().includes(rollIdSearch.toLowerCase()) &&
        binLocation.toLowerCase().includes(binLocationSearch.toLowerCase())
      );
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'goods_receive_date') {
            const dateA = aValue ? new Date(aValue) : new Date(0);
            const dateB = bValue ? new Date(bValue) : new Date(0);
            if (dateA < dateB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (dateA > dateB) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        }

        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [rolls, kindAndGsmSearch, widthSearch, batchSearch, rollIdSearch, binLocationSearch, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredRolls.length / ITEMS_PER_PAGE);

  const paginatedRolls = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAndFilteredRolls.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAndFilteredRolls, currentPage]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };
  
  if (loading) {
    return <div>Loading inventory...</div>;
  }

  return (
    <div>
      <h1>Inventory</h1>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by Roll ID"
          value={rollIdSearch}
          onChange={e => {setRollIdSearch(e.target.value); setCurrentPage(1);}}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="text"
          placeholder="Search by Bin Location"
          value={binLocationSearch}
          onChange={e => {setBinLocationSearch(e.target.value); setCurrentPage(1);}}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="text"
          placeholder="Search by Kind or GSM"
          value={kindAndGsmSearch}
          onChange={e => {setKindAndGsmSearch(e.target.value); setCurrentPage(1);}}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="text"
          placeholder="Search by Width"
          value={widthSearch}
          onChange={e => {setWidthSearch(e.target.value); setCurrentPage(1);}}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="text"
          placeholder="Search by Batch"
          value={batchSearch}
          onChange={e => {setBatchSearch(e.target.value); setCurrentPage(1);}}
          style={{ padding: '5px' }}
        />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handlePreviousPage} disabled={currentPage === 1}>Previous</button>
        <span style={{ margin: '0 10px' }}>Page {currentPage} of {totalPages}</span>
        <button onClick={handleNextPage} disabled={currentPage === totalPages}>Next</button>
      </div>
      <table>
        <thead>
          <tr>
            <th onClick={() => requestSort('roll_id')} style={{ cursor: 'pointer' }}>Roll ID</th>
            <th onClick={() => requestSort('batch')} style={{ cursor: 'pointer' }}>Batch</th>
            <th onClick={() => requestSort('kind')} style={{ cursor: 'pointer' }}>Kind</th>
            <th onClick={() => requestSort('gsm')} style={{ cursor: 'pointer' }}>GSM</th>
            <th onClick={() => requestSort('width')} style={{ cursor: 'pointer' }}>Width</th>
            <th onClick={() => requestSort('length')} style={{ cursor: 'pointer' }}>Length</th>
            <th onClick={() => requestSort('diameter')} style={{ cursor: 'pointer' }}>Diameter</th>
            <th onClick={() => requestSort('bin_location')} style={{ cursor: 'pointer' }}>Bin Location</th>
            <th onClick={() => requestSort('goods_receive_date')} style={{ cursor: 'pointer' }}>Goods Receive Date</th>
            <th onClick={() => requestSort('aging')} style={{ cursor: 'pointer' }}>Aging (days)</th>
            <th onClick={() => requestSort('weight')} style={{ cursor: 'pointer' }}>Weight</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRolls.length > 0 ? (
            paginatedRolls.map(roll => (
              <tr key={roll.roll_id}>
                <td>{roll.roll_id}</td>
                <td>{roll.batch}</td>
                <td>{roll.kind}</td>
                <td>{roll.gsm}</td>
                <td>{roll.width}</td>
                <td>{roll.length}</td>
                <td>{roll.diameter}</td>
                <td>{roll.bin_location}</td>
                <td>{roll.goods_receive_date ? formatDate(new Date(roll.goods_receive_date)) : 'N/A'}</td>
                <td>{roll.aging}</td>
                <td>{roll.weight}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="11">
                No inventory found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
