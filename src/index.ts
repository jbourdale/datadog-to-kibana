import { fetchMonitorsBasedOnLogs } from "./datadog/alerts"
import { fetchDashboardUsingLogs } from "./datadog/dashboards"

const run = async () => {
    console.log('dtk:index | Start') // not using debug because it collides with datadog client library which is miss configured
    
    await fetchDashboardUsingLogs()
    await fetchMonitorsBasedOnLogs()

    console.log('dtk:index | Done')
}

run()
