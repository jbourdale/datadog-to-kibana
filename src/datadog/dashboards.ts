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

const widgetBasedOnServiceLogs = (
  widget: v1.Widget,
  service: string
): boolean => {
  const serviceRgx = new RegExp(`("|{| |,)service:${service}*`, "g");

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

  const filteredRequests = requests.filter((request) => {
    const queries = request.queries;
    if (!queries || !Array.isArray(queries)) return false;
    return queries.some(
      (query) => query.dataSource === "logs" && query.query?.match(serviceRgx)
    );
  });

  console.log(
    "filteredRequests : ",
    filteredRequests.map((r) => r.queries)
  );
  return true;
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
  service: string
): Promise<any> => {
  const dashboards = await fetchDashboardUsingLogs();
  dashboards.filter((d) => containsWidgetBasedOnServiceLogs(d, service));
  return null;
};
