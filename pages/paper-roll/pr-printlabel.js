import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { QRCode } from 'qrcode.react';

const PrintLabelPage = () => {
    const router = useRouter();
    const { roll_id } = router.query;
    const [roll, setRoll] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inputId, setInputId] = useState('');

    useEffect(() => {
        if (!roll_id) {
            setLoading(false);
            return;
        }

        const fetchRollData = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error } = await supabase
                    .from('pr_stock')
                    .select('*')
                    .eq('roll_id', roll_id)
                    .single();

                if (error) throw error;
                if (!data) throw new Error(`Roll ID ${roll_id} not found.`);
                
                setRoll(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRollData();
    }, [roll_id]);

    const handleInputChange = (e) => {
        setInputId(e.target.value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputId.trim()) {
            router.push(`/paper-roll/pr-printlabel?roll_id=${inputId.trim()}`);
        }
    };

    if (loading) return <div>Loading label data...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!roll) {
        return (
            <div className="label-container">
                <style jsx>{`
                    .label-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 20px;
                        background-color: #f0f0f0;
                    }
                    .form-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        margin-top: 20px;
                    }
                    .input-field {
                        padding: 10px;
                        font-size: 1em;
                        margin-bottom: 10px;
                        width: 300px;
                    }
                    .submit-button {
                        padding: 10px 20px;
                        cursor: pointer;
                        font-size: 1em;
                    }
                `}</style>
                <div className="form-container">
                    <h2>Print Paper Roll Label</h2>
                    <p>Please enter the Paper Roll ID to generate the label.</p>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            value={inputId}
                            onChange={handleInputChange}
                            placeholder="Enter Paper Roll ID"
                            className="input-field"
                        />
                        <button type="submit" className="submit-button">
                            Generate Label
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="label-container">
            <style jsx>{`
                .label-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px;
                    background-color: #f0f0f0;
                }
                .label {
                    border: 2px solid black;
                    padding: 15px;
                    width: 400px;
                    font-family: Arial, sans-serif;
                    background-color: white;
                }
                .label-header {
                    text-align: center;
                    font-weight: bold;
                    font-size: 1.2em;
                    margin-bottom: 10px;
                    border-bottom: 1px solid black;
                    padding-bottom: 5px;
                }
                .label-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .label-details {
                    display: flex;
                    flex-direction: column;
                }
                .label-details p {
                    margin: 3px 0;
                    font-size: 0.9em;
                }
                .label-details strong {
                    display: inline-block;
                    width: 80px;
                }
                .qr-code-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .qr-code {
                    padding: 5px;
                    border: 1px solid #ccc;
                }
                .qr-code-text {
                    font-size: 0.8em;
                    font-weight: bold;
                    margin-top: 5px;
                }
                .print-button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-size: 1em;
                }
                @media print {
                    .print-button, .label-container {
                        background-color: white !important;
                    }
                    .print-button {
                        display: none;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                         margin: 0;
                         background-color: white;
                    }
                    .label-container {
                        padding: 0;
                        justify-content: flex-start;
                        align-items: flex-start;
                    }
                    .label {
                        border: none;
                        width: 100%;
                    }
                }
            `}</style>

            <div className="label">
                <div className="label-header">PAPER ROLL TAG</div>
                <div className="label-content">
                    <div className="label-details">
                        <p><strong>Kind:</strong> {roll.kind}</p>
                        <p><strong>GSM:</strong> {roll.gsm}</p>
                        <p><strong>Width:</strong> {roll.width} mm</p>
                        <p><strong>Diameter:</strong> {roll.diameter} mm</p>
                        <p><strong>Weight:</strong> {roll.weight} kg</p>
                        <p><strong>Batch:</strong> {roll.batch}</p>
                        <p><strong>Rcvd Date:</strong> {new Date(roll.goods_receive_date || roll.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="qr-code-container">
                        <div className="qr-code">
                            <QRCode value={roll.roll_id} size={110} />
                        </div>
                        <span className="qr-code-text">{roll.roll_id}</span>
                    </div>
                </div>
            </div>

            <button className="print-button" onClick={() => window.print()}>
                Print Label
            </button>
        </div>
    );
};

export default PrintLabelPage;
