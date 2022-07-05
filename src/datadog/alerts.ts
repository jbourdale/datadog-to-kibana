import { v1 } from "@datadog/datadog-api-client"
import { LOG_ALERT } from "@datadog/datadog-api-client/dist/packages/datadog-api-client-v1/models/MonitorType"

import axios from 'axios'

export const fetchMonitorsBasedOnLogs = async (): Promise<Array<v1.Monitor>> => {
    console.log('dtk:datadog:alerts | Fetching monitors')
    // Using axios instead of datadog client due to a bug inside listMonitors() that doesn't allow 
    // to fetch monitors that I guess are too old
    const response = await axios.get('https://api.datadoghq.com/api/v1/monitor', {
        headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': process.env.DD_API_KEY || '',
            'DD-APPLICATION-KEY': process.env.DD_APP_KEY || ''
        }
    })
    console.log('dtk:datadog:alerts | Done')

    const monitors = response.data as Array<v1.Monitor>
    console.log('dtk:datadog:alerts | Monitors count found : ', monitors.length)

    const monitorsUsingLogs = monitors?.filter(m => m.type === LOG_ALERT)
    
    console.log('dtk:datadog:alerts | Monitors using logs count found', monitorsUsingLogs?.length)
    return monitorsUsingLogs
}