import {
  fetchMonitorsUsingApmServiceWithoutTags,
  findLogServiceInMonitors,
} from "./datadog/alerts";
import { findLogServiceInDashboardWidgets } from "./datadog/dashboards";
// import { fetchDashboardUsingLogs } from "./datadog/dashboards";

const run = async () => {
  console.log("dtk:index | Start"); // not using debug because it collides with datadog client library which is miss configured

  //   await fetchDashboardUsingLogs();
  // await fetchMonitorsUsingApmServiceWithoutTags();
  await findLogServiceInMonitors("service_name");
  await findLogServiceInDashboardWidgets("service_name");

  console.log("dtk:index | Done");
};

run();
