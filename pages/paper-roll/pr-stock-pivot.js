
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase/client';

const PrStockPivot = ({ plant }) => {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rowField, setRowField] = useState('kind');
  const [rowField2, setRowField2] = useState('gsm'); // New state for second row
  const [colField, setColField] = useState('width');
  const [valueField, setValueField] = useState('weight');
  const [filterField, setFilterField] = useState(''); // New state for filter field
  const [filterValue, setFilterValue] = useState(''); // New state for filter value

  useEffect(() => {
    const fetchStockData = async () => {
      setLoading(true);
      try {
        let query = supabase.from('pr_stock').select('*');

        if (plant) {
          query = query.eq('plant', plant);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching stock data:', error);
          setStockData([]);
        } else {
          setStockData(data);
        }
      } catch (error) {
        console.error('Error fetching stock data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (plant) {
      fetchStockData();
    } else {
      setStockData([]);
      setLoading(false);
    }
  }, [plant]);

  const filteredStockData = useMemo(() => {
    if (!filterField || !filterValue) {
      return stockData;
    }
    return stockData.filter(item => {
        if (item[filterField] === null || item[filterField] === undefined) return false;
        return String(item[filterField]).toLowerCase().includes(filterValue.toLowerCase());
    });
  }, [stockData, filterField, filterValue]);

  const pivotData = useMemo(() => {
    if (!filteredStockData.length || !rowField || !colField) {
      return { pivotRows: [], pivotCols: [], aggregation: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };
    }

    const pivotRows = [...new Set(filteredStockData.map(item => `${item[rowField]} | ${rowField2 ? item[rowField2] : ''}`))].sort();
    const pivotCols = [...new Set(filteredStockData.map(item => item[colField]))].sort((a,b) => a-b);

    const aggregation = {};
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;

    pivotRows.forEach(row => rowTotals[row] = 0);
    pivotCols.forEach(col => colTotals[col] = 0);

    filteredStockData.forEach(item => {
      const rowValue = `${item[rowField]} | ${rowField2 ? item[rowField2] : ''}`;
      const colValue = item[colField];
      
      let aggValue;
      if (valueField === 'roll_count') {
          aggValue = 1;
      } else {
          aggValue = item[valueField] || 0;
      }

      if (!aggregation[rowValue]) {
        aggregation[rowValue] = {};
      }
      if (!aggregation[rowValue][colValue]) {
        aggregation[rowValue][colValue] = 0;
      }
      aggregation[rowValue][colValue] += aggValue;

      rowTotals[rowValue] = (rowTotals[rowValue] || 0) + aggValue;
      colTotals[colValue] = (colTotals[colValue] || 0) + aggValue;
      grandTotal += aggValue;
    });

    return { pivotRows, pivotCols, aggregation, rowTotals, colTotals, grandTotal };
  }, [filteredStockData, rowField, rowField2, colField, valueField]);

  const fieldOptions = stockData.length > 0 ? Object.keys(stockData[0]) : [];
  const uniqueFilterValues = useMemo(() => {
      if(!filterField) return [];
      return [...new Set(stockData.map(item => item[filterField]))].filter(Boolean).sort();
  }, [stockData, filterField]);


  if (loading) {
    return <div>Loading stock data...</div>;
  }

  return (
    <div>
      <h1>Paper Roll Stock Pivot</h1>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
         <label>
          Row 1:
          <select value={rowField} onChange={e => setRowField(e.target.value)}>
            {fieldOptions.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </label>
        <label>
          Row 2:
          <select value={rowField2} onChange={e => setRowField2(e.target.value)}>
            <option value="">None</option>
            {fieldOptions.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </label>
        <label>
          Column:
          <select value={colField} onChange={e => setColField(e.target.value)}>
            {fieldOptions.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </label>
        <label>
          Value:
          <select value={valueField} onChange={e => setValueField(e.target.value)}>
            <option value="roll_count">Number of Rolls</option>
            {fieldOptions.filter(field => typeof stockData[0]?.[field] === 'number').map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </label>
        <label>
          Filter Field:
          <select value={filterField} onChange={e => {setFilterField(e.target.value); setFilterValue('');}}>
            <option value="">None</option>
            {fieldOptions.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </label>
        {filterField && (
          <label>
            Filter Value:
            <input 
                list={`datalist-${filterField}`}
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
            />
            <datalist id={`datalist-${filterField}`}>
                {uniqueFilterValues.map(val => <option key={val} value={val} />)}
            </datalist>
          </label>
        )}
      </div>
      <table>
        <thead>
          <tr>
            <th>{rowField}{rowField2 && ` / ${rowField2}`} \ {colField}</th>
            {pivotData.pivotCols.map(col => <th key={col}>{col}</th>)}
            <th>Grand Total</th>
          </tr>
        </thead>
        <tbody>
          {pivotData.pivotRows.map(row => (
            <tr key={row}>
              <td>{row}</td>
              {pivotData.pivotCols.map(col => (
                <td key={col}>
                  {pivotData.aggregation?.[row]?.[col] ? (valueField === 'roll_count' ? pivotData.aggregation[row][col] : pivotData.aggregation[row][col].toFixed(2)) : 0}
                </td>
              ))}
              <td>
                {pivotData.rowTotals?.[row] ? (valueField === 'roll_count' ? pivotData.rowTotals[row] : pivotData.rowTotals[row].toFixed(2)) : 0}
              </td>
            </tr>
          ))}
          <tr>
              <td><strong>Grand Total</strong></td>
              {pivotData.pivotCols.map(col => (
                  <td key={col}>
                      <strong>
                          {pivotData.colTotals?.[col] ? (valueField === 'roll_count' ? pivotData.colTotals[col] : pivotData.colTotals[col].toFixed(2)) : 0}
                      </strong>
                  </td>
              ))}
              <td>
                  <strong>
                      {pivotData.grandTotal ? (valueField === 'roll_count' ? pivotData.grandTotal : pivotData.grandTotal.toFixed(2)) : 0}
                  </strong>
              </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default PrStockPivot;
