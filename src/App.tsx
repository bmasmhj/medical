import { useEffect, useState } from 'react'
import io, { Socket } from 'socket.io-client'
import { CSVManager } from './components/CSVManager'

interface BackendResponse {
    item: string
    message: string
    time: string
}

function App(): JSX.Element {
    const [socket, setSocket] = useState<Socket | null>(null)
    const [response, setResponse] = useState<BackendResponse | null>(null)
    const [topFiveResponses, setTopFiveResponses] = useState<BackendResponse[]>([])

    useEffect(() => {
        // Connect to local backend
        const s = io('http://localhost:5175')
        setSocket(s)

        s.on('connect', () => {
            console.log('Connected to backend')
        })

        // on error of socket connection alert the user
        s.on('connect_error', (err) => {
            console.error('Connection error:', err)
            alert('Failed to connect to backend: ' + err.message)
        })

        s.on('pong-backend', (data: BackendResponse) => {
            // console.log('Received pong:', data)
            setResponse(data)
            setTopFiveResponses(prev => [...prev, data].slice(-15))
        })

        return () => {
            s.disconnect()
        }
    }, [])

    const pingBackend = () => {
        if (socket) {
            socket.emit('ping-backend')
        }
    }

    return (
        <div className='w-full h-screen flex flex-row'>
            <div className='w-full h-screen flex flex-col'>
                <div className="flex-1 overflow-hidden">
                    <CSVManager pingBackend={pingBackend} response={response} />
                </div>
            </div>
            <div className="overflow-hidden rounded-lg bg-slate-900 shadow-2xl ring-1 ring-white/10 w-[400px]">
                <div className="flex items-center bg-slate-800/50 px-4 py-2">
                    <div className="ml-4 text-xs font-medium text-slate-400">{response?.item}</div>
                </div>
                <div className="p-6 font-mono text-sm leading-relaxed text-slate-300">
                    <div className="flex">
                        <span className="shrink-0 text-emerald-400">~</span>
                        <span className="ml-2 flex-1">
                            <span className="text-sky-400">price@products % cat logs </span>
                        </span>
                    </div>
                    {/* <div className="mt-2">
                        <pre className="text-emerald-400 whitespace-pre-wrap">
                            {response}
                        </pre>
                    </div> */}
                    {topFiveResponses.map((response, index) => (
                        <div key={index}>
                            <pre className="text-emerald-400 whitespace-pre-wrap">
                                [{response.item}] {response.message}
                            </pre>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default App
