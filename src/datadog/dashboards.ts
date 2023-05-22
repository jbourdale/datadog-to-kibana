import { client, v1 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v1.DashboardsApi(configuration);

const WHITELISTED_DASHBOARD_IDS =
  process.env.WHITELISTED_DASHBOARD_IDS?.split(",") || [];

const widgetBasedOnLogs = (widget: v1.Widget): boolean => {
  // Recursive call for widgets holding other widgets (groups)
  const innerWidgets = (widget.definition as any)["widgets"];
  if (innerWidgets && Array.isArray(innerWidgets)) {
    return innerWidgets.some((innerWidget) => widgetBasedOnLogs(innerWidget));
  }

  // Look for queries with dataSource === logs
  const requests = (widget.definition as any)["requests"];
  if (!requests || !Array.isArray(requests)) return false;

  return requests.some((request) => {
    const queries = request.queries;
    if (!queries || !Array.isArray(queries)) return false;
    return queries.some((query) => query.dataSource === "logs");
  });
};


const searchkeywords = [".net",".conntrack",".read" ,".bandwidth",".sent", ".rcvd"]

const widgetBasedOnNetwork = (widget: v1.Widget): boolean => {
  // Recursive call for widgets holding other widgets (groups)
  const innerWidgets = (widget.definition as any)["widgets"];
  if (innerWidgets && Array.isArray(innerWidgets)) {
    return innerWidgets.some((innerWidget) => widgetBasedOnNetwork(innerWidget));
  }

  // Look for queries with dataSource === logs
  const requests = (widget.definition as any)["requests"];
  if (!requests || !Array.isArray(requests)) return false;

  return requests.some((request) => {
    const queries = request.queries;
    if (!queries || !Array.isArray(queries)) return false;
    return queries.some((query) => searchkeywords.some(k => (query.query as string).includes(k)));
  });
};

const widgetBasedOnServiceLogs = (
  widget: v1.Widget,
  service: string
): boolean => {
  const serviceRgx = new RegExp(`service:${service}`, "g");

  // Recursive call for widgets holding other widgets (groups)
  const innerWidgets = (widget.definition as any)["widgets"];
  if (innerWidgets && Array.isArray(innerWidgets)) {
    return innerWidgets.some((innerWidget) =>
      widgetBasedOnServiceLogs(innerWidget, service)
    );
  }

  // Look for queries with dataSource === logs
  const requests = (widget.definition as any)["requests"];
  if (!requests || !Array.isArray(requests)) return false;


  const logsRequests = requests.filter(r => {
    const queries = r.queries;
    return queries?.some((q: any) => q.dataSource == "logs")
  })

  // console.log("logsQueries : ", logsRequests)
  const logQueries = logsRequests.map((req) => {
    const queries = req.queries
    return queries?.map((q: any) => q.search?.query)
  })

  const servicesQuery = logQueries.filter(lq => {
    return lq.some((lqq: string) => {
      console.log("lqq : ", lqq)
      return lqq?.match(serviceRgx)
    })
  })

  console.log("servicesQuery : ", servicesQuery)
  return servicesQuery.length > 0

  // const filteredRequests = requests.filter((request) => {
  //   const queries = request.queries;
  //   if (!queries || !Array.isArray(queries)) return false;
  //   return queries.some(
  //     (query) => query.dataSource === "logs" && query.search?.query?.match(serviceRgx)
  //   );
  // });

  // console.log(
  //   "filteredRequests : ",
  //   filteredRequests
  // );
  return true; //filteredRequests.length <= 0;
};

const containsWidgetBasedOnServiceLogs = (
  dashboard: v1.Dashboard,
  service: string
) => {
  if (dashboard && dashboard.widgets && Array.isArray(dashboard.widgets)) {
    return dashboard.widgets.some((w) => widgetBasedOnServiceLogs(w, service));
  }
};

const containsWidgetBasedOnLogs = (dashboard: v1.Dashboard) => {
  if (dashboard && dashboard.widgets && Array.isArray(dashboard.widgets)) {
    return dashboard.widgets.some(widgetBasedOnLogs);
  }
};

const containsWidgetBasedOnNetwork = (dashboard: v1.Dashboard) => {
  if (dashboard && dashboard.widgets && Array.isArray(dashboard.widgets)) {
    return dashboard.widgets.some(widgetBasedOnNetwork);
  }
}

const fetchDashboard = async (
  dashboardId: string
): Promise<v1.Dashboard | undefined> => {
  if (WHITELISTED_DASHBOARD_IDS.includes(dashboardId)) {
    console.log("dtk:datadog:dashboard | Skipping dashboard", dashboardId);
    return;
  }
  try {
    return await apiInstance.getDashboard({ dashboardId });
  } catch (err: any) {
    throw new Error(`${err.message} for dashboardId: ${dashboardId}`);
  }
};

const fetchDashboardIds = async (): Promise<Array<string>> => {
  const response = await apiInstance.listDashboards({ filterShared: false });
  return response.dashboards?.map((d) => d.id as string) || [];
};

const fetchDashboards = async (): Promise<Array<v1.Dashboard>> => {
  console.log("dtk:datadog:dashboard | Fetching dashboard ids");
  const dashboardIds = await fetchDashboardIds();
  console.log("dtk:datadog:dashboard | Done");

  console.log("dtk:datadog:dashboard | Fetching dashboards");
  const results = await Promise.allSettled(
    dashboardIds.map((id) => fetchDashboard(id))
  );
  console.log("dtk:datadog:dashboard | Done");
  
  const errors = results.filter((result) => result.status === "rejected");
  if (errors && errors.length) {
    throw errors;
  }

  const dashboards = results.map(
    (result) => result.status === "fulfilled" && result.value
  ) as Array<v1.Dashboard>;
  console.log(
    "dtk:datadog:dashboard | Dashboard count found : ",
    dashboards.length
  );

  return dashboards;
}

export const fetchDashboardUsingLogs = async (): Promise<
  Array<v1.Dashboard>
> => {
  console.log("dtk:datadog:dashboard | Fetching dashboard ids");
  const dashboardIds = await fetchDashboardIds();
  console.log("dtk:datadog:dashboard | Done");

  console.log("dtk:datadog:dashboard | Fetching dashboards");
  const results = await Promise.allSettled(
    dashboardIds.map((id) => fetchDashboard(id))
  );
  console.log("dtk:datadog:dashboard | Done");

  const errors = results.filter((result) => result.status === "rejected");
  if (errors && errors.length) {
    throw errors;
  }

  const dashboards = results.map(
    (result) => result.status === "fulfilled" && result.value
  ) as Array<v1.Dashboard>;
  console.log(
    "dtk:datadog:dashboard | Dashboard count found : ",
    dashboards.length
  );

  const dashboardsBasedOnLogs = dashboards.filter((d) =>
    containsWidgetBasedOnLogs(d)
  );
  console.log(
    "dtk:datadog:dashboard | Dashboard using logs count found : ",
    dashboardsBasedOnLogs.length
  );
  return dashboardsBasedOnLogs;
};

export const findLogServiceInDashboardWidgets = async (
  service: string, dashboards?: v1.Dashboard[]
): Promise<v1.Dashboard[]> => {
  if (!dashboards) {
    dashboards = await fetchDashboardUsingLogs();
  }
  return dashboards.filter((d) => containsWidgetBasedOnServiceLogs(d, service));
};

export const fetchDashboardsUsingNetwork = async(
): Promise<any> => {
  const dashboards = await fetchDashboards();
  dashboards.filter(d => containsWidgetBasedOnNetwork(d));
  return dashboards
}