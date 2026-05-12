import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabase/client';

export default function AnalysisPage({ plant }) {
  const [paperRolls, setPaperRolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchPaperRolls = async () => {
      if (!plant) {
        setPaperRolls([]);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        let allRolls = [];
        let page = 0;
        const pageSize = 1000;
        let lastPage = false;

        while (!lastPage) {
          const { data, error: fetchError } = await supabase
            .from('pr_stock')
            .select('kind, gsm, width, weight, goods_receive_date')
            .eq('plant', plant)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (fetchError) {
            throw fetchError;
          }

          if (data) {
            allRolls = [...allRolls, ...data];
          }

          if (!data || data.length < pageSize) {
            lastPage = true;
          }
          page++;
        }

        const processedRolls = allRolls.map(roll => ({
          ...roll,
          aging: (new Date() - new Date(roll.goods_receive_date)) / (1000 * 60 * 60 * 24),
        }));

        setPaperRolls(processedRolls);

      } catch (error) {
        console.error('Error fetching paper rolls for plant:', plant, error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaperRolls();
  }, [plant]);

  // State for expanded rows
  const [expandedAging, setExpandedAging] = useState(new Set());
  const [expandedKinds, setExpandedKinds] = useState(new Set());
  const [expandedGsms, setExpandedGsms] = useState(new Set());

  const toggleAging = (key) => {
    setExpandedAging(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleKind = (key) => {
    setExpandedKinds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };
 
  const toggleGsm = (key) => {
    setExpandedGsms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleWidthClick = () => {
    router.push('/inventory');
  };

  const nestedStats = useMemo(() => {
    if (isLoading || !paperRolls) {
      return {};
    }

    const stats = {
      under3: { rolls: 0, weight: 0, kinds: {} },
      '3to6': { rolls: 0, weight: 0, kinds: {} },
      '6to12': { rolls: 0, weight: 0, kinds: {} },
      over12: { rolls: 0, weight: 0, kinds: {} },
    };

    paperRolls.forEach(roll => {
      if (!Number.isFinite(roll.aging)) {
        return;
      }

      let categoryKey;
      const agingDays = roll.aging;
      if (agingDays < 90) categoryKey = 'under3';
      else if (agingDays < 180) categoryKey = '3to6';
      else if (agingDays < 365) categoryKey = '6to12';
      else categoryKey = 'over12';

      const kind = roll.kind || 'Unknown';
      const gsm = String(roll.gsm || 'N/A');
      const width = String(roll.width || 'N/A');
      const rollCount = 1;
      const weight = roll.weight || 0;

      const category = stats[categoryKey];
      category.rolls += rollCount;
      category.weight += weight;

      if (!category.kinds[kind]) {
        category.kinds[kind] = { rolls: 0, weight: 0, gsms: {} };
      }
      const kindStat = category.kinds[kind];
      kindStat.rolls += rollCount;
      kindStat.weight += weight;
     
      if (!kindStat.gsms[gsm]) {
        kindStat.gsms[gsm] = { rolls: 0, weight: 0, widths: {} };
      }
      const gsmStat = kindStat.gsms[gsm];
      gsmStat.rolls += rollCount;
      gsmStat.weight += weight;

      if (!gsmStat.widths[width]) {
        gsmStat.widths[width] = { rolls: 0, weight: 0 };
      }
      const widthStat = gsmStat.widths[width];
      widthStat.rolls += rollCount;
      widthStat.weight += weight;
    });

    return stats;
  }, [paperRolls, isLoading]);

  const agingData = [
    { key: 'under3', category: 'Under 3 Months', stats: nestedStats.under3 },
    { key: '3to6', category: '3-6 Months', stats: nestedStats['3to6'] },
    { key: '6to12', category: '6-12 Months', stats: nestedStats['6to12'] },
    { key: 'over12', category: 'Over 12 Months', stats: nestedStats.over12 },
  ];

  return (
    <div>
      <h1>Stock Age Summary</h1>
      {error && <p>Error: {error}</p>}
      <div>
        <div>
          <p>
            A detailed table of the number of rolls and weight by age category. Click a row to see details.
          </p>
        </div>
        <div>
          <table>
            <thead>
              <tr>
                <th>Details</th>
                <th>Number of Rolls</th>
                <th>Total Weight (kg)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="3">Loading...</td>
                </tr>
              ) : (
                agingData.map(agingItem => (
                  <React.Fragment key={agingItem.key}>
                    <tr onClick={() => toggleAging(agingItem.key)}>
                      <td>
                        <span>
                          {expandedAging.has(agingItem.key) ? '▼' : '▶'}
                        </span>
                        {agingItem.category}
                      </td>
                      <td>
                        {agingItem.stats.rolls.toLocaleString()}
                      </td>
                      <td>
                        {agingItem.stats.weight.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                    {expandedAging.has(agingItem.key) && Object.entries(agingItem.stats.kinds).sort(([,a], [,b]) => b.weight - a.weight).map(([kindName, kindStats]) => {
                      const kindKey = `${agingItem.key}-${kindName}`;
                      const isKindExpanded = expandedKinds.has(kindKey);
                      return (
                        <React.Fragment key={kindKey}>
                          <tr onClick={() => toggleKind(kindKey)}>
                            <td style={{ paddingLeft: '2rem' }}>
                              <span>
                                {isKindExpanded ? '▼' : '▶'}
                              </span>
                              {kindName}
                            </td>
                            <td>{kindStats.rolls.toLocaleString()}</td>
                            <td>{kindStats.weight.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          </tr>
                          {isKindExpanded && Object.entries(kindStats.gsms).sort(([gsmA], [gsmB]) => Number(gsmB) - Number(gsmA)).map(([gsmValue, gsmStats]) => {
                            const gsmKey = `${kindKey}-${gsmValue}`;
                            const isGsmExpanded = expandedGsms.has(gsmKey);
                            return (
                              <React.Fragment key={gsmKey}>
                                <tr onClick={() => toggleGsm(gsmKey)}>
                                  <td style={{ paddingLeft: '4rem' }}>
                                    <span>
                                      {isGsmExpanded ? '▼' : '▶'}
                                    </span>
                                    GSM: {gsmValue}
                                  </td>
                                  <td>{gsmStats.rolls.toLocaleString()}</td>
                                  <td>{gsmStats.weight.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                </tr>
                                {isGsmExpanded && Object.entries(gsmStats.widths).sort(([widthA], [widthB]) => Number(widthB) - Number(widthA)).map(([widthValue, widthStats]) => (
                                  <tr
                                    key={`${gsmKey}-${widthValue}`}
                                    onClick={handleWidthClick}
                                  >
                                    <td style={{ paddingLeft: '6rem' }}>
                                      <span>Width: {widthValue}</span>
                                    </td>
                                    <td>{widthStats.rolls.toLocaleString()}</td>
                                    <td>{widthStats.weight.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}