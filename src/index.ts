import {
  fetchMonitorsNotifyingASpecificDestination,
  fetchMonitorsUsingApmServiceWithoutTags,
  findLogServiceInMonitors,
} from "./datadog/alerts";
import * as fs from "fs"
import { fetchDashboardsUsingNetwork, fetchDashboardUsingLogs, findLogServiceInDashboardWidgets } from "./datadog/dashboards";
// import { fetchDashboardUsingLogs } from "./datadog/dashboards";

const SERVICES = [ "mta-events"]
// const SERVICES  = ["sendmail"]

const fetchDashboards = async () => {
  const dashboards = await fetchDashboardUsingLogs()
  console.log("dashboards : ", dashboards)
  const csv = SERVICES.map(async service => {
    try {
      const dwithlog = await findLogServiceInDashboardWidgets(service, dashboards);
      console.log(`dashboards for service ${service} : `, dwithlog.length)
      return dwithlog.map((d) => {
        return `${service}, ${d?.title}, https://app.datadoghq.com/dashboard/${d?.id}`
      }).join('\n')
    } catch (error) {
      console.error("error : ", error)
    }
  })

  return Promise.all(csv)
}

const fetchAlerts = async () => {
  const csv = SERVICES.map(async service => {
    try {
      const dwithlog = await findLogServiceInMonitors(service);
      console.log(`alerts for service ${service} : `, dwithlog.length)
      return dwithlog.map((d) => {
        return `${service}, ${d?.name}, https://app.datadoghq.com/dashboard/${d?.id}`
      }).join('\n')
    } catch (error) {
      console.error("error : ", error)
    }
  })

  return Promise.all(csv)
}


const run = async () => {
  console.log("dtk:index | Start"); // not using debug because it collides with datadog client library which is miss configured

    // await fetchDashboardUsingLogs();
    // await fetchMonitorsUsingApmServiceWithoutTags();
    // await (SERVICE);
    // await fetchDashboardsUsingNetwork()
  
  // let csv = ""
  // try {
  //   const csv = await fetchDashboards()
  //   const content = csv.join("\n")
    
  //   fs.writeFile(`./dashboards.csv`, content, err => {
  //     if (err) {
  //       console.error(err);
  //     } 
  //   });
  
  //   const alerts = await fetchAlerts()
  //   const alertcontent = alerts.join("\n")
  
  //   fs.writeFile(`./dashboards.csv`, alertcontent, err => {
  //     if (err) {
  //       console.error(err);
  //     } 
  //   });
  // } catch(error) {
  //   console.error(error)
  // }

  // console.log("dtk:index | Done");

  try {
    const notificationName = "Pagerduty: Log_Platform"
    const monitors = await fetchMonitorsNotifyingASpecificDestination(notificationName)

    let csv = monitors.reduce((acc, m) => {
      acc += `${m.name.replace(',', " ")}, https://app.datadoghq.com/monitors/${m.id}`
      acc += '\n'
      return acc
    }, "name, link\n")

    console.log("csv :", csv)

    fs.writeFile(`./alerts_for_${notificationName.replace(" ", "_")}.csv`, csv, err => {
      if (err) {
        console.error(err);
      } 
    })
  } catch (error) {
    console.error("error : ", error)
  }
};

run();
