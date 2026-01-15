import { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
    ClientSideRowModelModule,
    ColDef,
    ModuleRegistry,
    ValidationModule,
    TextFilterModule,
    NumberFilterModule,
    PaginationModule,
    RowSelectionModule,
    TextEditorModule
} from 'ag-grid-community';
import { themeQuartz } from 'ag-grid-community';

ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ValidationModule,
    TextFilterModule,
    NumberFilterModule,
    PaginationModule,
    RowSelectionModule,
    TextEditorModule
]);

export function CSVManager({ pingBackend, response }) {
    const [rowData, setRowData] = useState<any[]>([]);
    const [updateRowData, setUpdateRowData] = useState(false);
    const [colDefs, setColDefs] = useState<ColDef[]>([]);
    const [uploading, setUploading] = useState(false);

    const API_URL = 'http://localhost:5175/api';

    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/data`);
            const data = await response.json();
            setRowData(data);

            if (data.length > 0) {
                const cols = Object.keys(data[0]).map(key => ({
                    field: key,
                    editable: true,
                    filter: true,
                    flex: 1,
                    minWidth: 150
                }));
                setColDefs(cols);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async () => {
        try {
            await fetch(`${API_URL}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: rowData })
            });
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Failed to save data');
        }
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            alert('Failed to upload file');
        } finally {
            setUploading(false);
            // Reset input
            event.target.value = '';
        }
    };

    const handleDownload = () => {
        window.open(`${API_URL}/download`, '_blank');
    };

    const theme = useMemo(() => {
        return themeQuartz.withParams({
            spacing: 12,
            accentColor: '#4299E1', // Blue-500
        });
    }, []);

    // auto upload on changes
    useEffect(() => {
        if (updateRowData) {
            handleSave();
            setUpdateRowData(false);
        }
    }, [updateRowData]);

    return (
        <div className="h-full w-full flex flex-col p-4 space-y-4 bg-gray-50">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-xl font-bold text-gray-800">Data Management</h2>
                {response?.item && <h2 className='text-xl font-bold text-gray-800'>Updating : {response?.item}</h2>}
                <div className="flex gap-4">
                    <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded cursor-pointer transition-colors">
                        {uploading ? 'Uploading...' : 'Upload CSV'}
                        <input
                            type="file"
                            accept=".csv, .xlsx, .xls"
                            onChange={handleUpload}
                            className="hidden"
                            disabled={uploading}
                        />
                    </label>
                    <button
                        onClick={pingBackend}
                        style={{
                            padding: '10px 20px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px'
                        }}
                    >
                        Update Price
                    </button>
                    {/* <button
                        onClick={handleSave}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
                    >
                        Save Changes
                    </button> */}
                    <button
                        onClick={handleDownload}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                    >
                        Download CSV
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="h-full w-full">
                    <AgGridReact
                        theme={theme}
                        rowData={rowData}
                        columnDefs={colDefs}
                        defaultColDef={{
                            sortable: true,
                            resizable: true,
                        }}
                        onCellValueChanged={() => setUpdateRowData(true)}
                        pagination={false}
                    />
                </div>
            </div>
        </div>
    );
}
