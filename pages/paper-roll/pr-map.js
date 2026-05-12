import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';

const PRMap = () => {
    const [stockData, setStockData] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStock = async () => {
            const { data, error } = await supabase
                .from('pr_stock')
                .select('bin_location, kind, gsm, width');

            if (error) {
                setError(`Error fetching stock: ${error.message}`);
                return;
            }

            const processedData = data.reduce((acc, roll) => {
                const { bin_location, kind, gsm, width } = roll;
                if (!bin_location) return acc;

                const groupKey = `${kind}${gsm}${width}`;
                if (!acc[bin_location]) {
                    acc[bin_location] = {};
                }
                if (!acc[bin_location][groupKey]) {
                    acc[bin_location][groupKey] = {
                        name: `${kind} ${gsm} ${width}`,
                        count: 0
                    };
                }
                acc[bin_location][groupKey].count++;
                return acc;
            }, {});

            setStockData(processedData);
        };

        fetchStock();
    }, []);
    
    const renderMap = () => {
        return (
            <div>
                <div>
                    <h3>MA12</h3>
                    {renderLocation('MA125245')}
                    {renderLocation('MA125230')}
                    {renderLocation('MA125220')}
                    {renderLocation('MA125205')}
                    {renderLocation('MA125185')}
                </div>

                <div>
                    <h3>MA15</h3>
                    {renderLocation('MA150130')}
                    {renderLocation('MA150135')}
                    {renderLocation('MA150140')}
                    {renderLocation('MA150145')}
                    {renderLocation('MA150150')}
                </div>
                
                 <div>
                    <h3>LA12</h3>
                    {renderLocation('LA125250')}
                    {renderLocation('LA125245')}
                    {renderLocation('LA125240')}
                    {renderLocation('LA125235')}
                    {renderLocation('LA125230')}
                </div>
                
                 <div>
                    Unloading Area
                </div>
            </div>
        );
    };

    const renderLocation = (location) => {
        const locationData = stockData[location];
        let content = location;
        if (locationData) {
            const groups = Object.values(locationData);
            content = groups.map(group => (
                <div key={group.name}>
                    <span>{group.name}</span>
                    <span>{group.count}</span>
                </div>
            ));
        }

        return (
            <div>
                <div>{location}</div>
                <div>{content !== location && content}</div>
            </div>
        );
    };


    return (
        <div>
            <h1>Paper Roll Warehouse Map</h1>
            {error && <p>{error}</p>}
            {renderMap()}
        </div>
    );
};

export default PRMap;
