import { v1, client } from "@datadog/datadog-api-client";
import { LOG_ALERT } from "@datadog/datadog-api-client/dist/packages/datadog-api-client-v1/models/MonitorType";

const configuration = client.createConfiguration();
const apiInstance = new v1.MonitorsApi(configuration);

import axios from "axios";

export const fetchMonitorsBasedOnLogs = async (): Promise<
  Array<v1.Monitor>
> => {
  console.log("dtk:datadog:alerts | Fetching monitors");
  // Using axios instead of datadog client due to a bug inside listMonitors() that doesn't allow
  // to fetch monitors that I guess are too old
  const response = await axios.get("https://api.datadoghq.com/api/v1/monitor", {
    headers: {
      "Content-Type": "application/json",
      "DD-API-KEY": process.env.DD_API_KEY || "",
      "DD-APPLICATION-KEY": process.env.DD_APP_KEY || "",
    },
  });
  console.log("dtk:datadog:alerts | Done");

  const monitors = response.data as Array<v1.Monitor>;
  console.log("dtk:datadog:alerts | Monitors count found : ", monitors.length);

  const monitorsUsingLogs = monitors?.filter((m) => m.type === LOG_ALERT);

  console.log(
    "dtk:datadog:alerts | Monitors using logs count found",
    monitorsUsingLogs?.length
  );
  return monitorsUsingLogs;
};

export const fetchMonitorsUsingApmServiceWithoutTags = async (): Promise<
  Array<v1.Monitor>
> => {
  console.log("dtk:datadog:alerts | Fetching monitors");

  // Using axios instead of datadog client due to a bug inside listMonitors() that doesn't allow
  // to fetch monitors that I guess are too old
  const response = await axios.get("https://api.datadoghq.com/api/v1/monitor", {
    headers: {
      "Content-Type": "application/json",
      "DD-API-KEY": process.env.DD_API_KEY || "",
      "DD-APPLICATION-KEY": process.env.DD_APP_KEY || "",
    },
  });

  console.log("dtk:datadog:alerts | Done");

  const monitors = response.data as Array<v1.Monitor>;
  console.log("dtk:datadog:alerts | Monitors count found : ", monitors.length);

  const monitorsWithQueryIncludingService = monitors?.filter(
    (m) => m.query.includes("service:") && m.type !== LOG_ALERT
  );
  console.log(
    "dtk:datadog:alerts | Monitors using service in query : ",
    monitorsWithQueryIncludingService.length
  );

  const monitorsWithoutServiceTags = monitorsWithQueryIncludingService?.filter(
    (m) => m.tags?.filter((t) => t.includes("service:")).length === 0
  );

  console.log(
    'dtk:datadog:alerts | Monitors having query including "service:" but no service: in tags count : ',
    monitorsWithoutServiceTags.length
  );

  console.log(
    "dtk:datadog:alerts | monitorsWithoutServiceTags : ",
    monitorsWithoutServiceTags
  );

  const serviceRg = new RegExp('("|{| |,)service:[a-z-._0-9]*', "g");
  const monitorsAndTheirServices = monitorsWithQueryIncludingService?.reduce(
    (acc, m) => {
      const services = Array.from(
        new Set(
          m.query
            .match(serviceRg)
            ?.map((s) => s.substring(1)) // remove " or { matched to be sure that it's only service: and not kube_service: for instance
            .filter((s) => s !== "service:") // remove services key that couldn't have been parsed (like queries with OR statements)
        )
      ); // remove duplicate using Set

      acc.push({
        services,
        monitor: m,
      });
      return acc;
    },
    [] as Array<{ services: string[]; monitor: v1.Monitor }>
  );

  const monitorsWithoutTheirServicesTags = monitorsAndTheirServices.filter(
    (ms) => {
      const servicesNotInTags = ms.services.filter(
        (s) => !ms.monitor.tags?.includes(s)
      );
      return servicesNotInTags.length > 0;
    }
  );

  console.log(
    "dtk:datadog:alerts | monitors without services tags count : ",
    monitorsWithoutTheirServicesTags.length
  );

  const updatedMonitors = monitorsWithoutTheirServicesTags.map((ms) => {
    ms.monitor.tags = [...(ms.monitor.tags || []), ...ms.services];
    return ms.monitor;
  });

  console.log(
    "dtk:datadog:alerts | updated monitors count : ",
    updatedMonitors.length
  );

  updatedMonitors.forEach(async (m) => {
    if (m.id) {
      console.log("dtk:datadog:alerts | updating monitor : ", m.id);
      try {
        await apiInstance.updateMonitor({
          monitorId: m.id,
          body: m,
        });
        console.log("dtk:datadog:alerts | done : ", m.id);
      } catch (e) {
        console.error("ERROR OCCURED FOR MONITOR ", m.id, " : ", e);
      }
    }
  });

  return monitorsWithQueryIncludingService;
};

export const findLogServiceInMonitors = async (
  currentName: string
): Promise<Array<v1.Monitor>> => {
  const response = await axios.get("https://api.datadoghq.com/api/v1/monitor", {
    headers: {
      "Content-Type": "application/json",
      "DD-API-KEY": process.env.DD_API_KEY || "",
      "DD-APPLICATION-KEY": process.env.DD_APP_KEY || "",
    },
  });
  console.log("dtk:datadog:alerts | Done");

  const monitors = response.data as Array<v1.Monitor>;
  console.log("dtk:datadog:alerts | Monitors count found : ", monitors.length);

  console.log(monitors[0])

  const monitorsUsingLogs = monitors?.filter((m) => m.type === LOG_ALERT);

  const serviceRgx = new RegExp(`("|{| |,)service:${currentName}*`, "g");
  const serviceMonitors = monitorsUsingLogs.filter((m) =>
    m.query.match(serviceRgx)
  );

  // console.log("serviceMonitors : ", serviceMonitors);
  return serviceMonitors;
};


export const fetchMonitorsNotifyingASpecificDestination = async (searchedNotificationName: String) => {
  
  const monitors = await getMonitors()
  console.log("dtk:datadog:monitors | Done");

  console.log("got monitors : ", monitors.length)

  const filteredMonitors = monitors.filter(m => {
    if (m.notifications && m.notifications.length > 0) {
      return m.notifications.some((n: {name: String, handle: String}) => {
        return n.name == searchedNotificationName
      })
    }

    return false
  })

  return filteredMonitors
}

const getMonitors = async (page: number = 0, per_page: number = 500) => {
  const monitors = []

  let resp = await axios.get(`https://api.datadoghq.com/api/v1/monitor/search?per_page=${per_page}&page=${page}`, {
    headers: {
      "Content-Type": "application/json",
      "DD-API-KEY": process.env.DD_API_KEY || "",
      "DD-APPLICATION-KEY": process.env.DD_APP_KEY || "",
    },
  });

  monitors.push(...resp.data.monitors)

  if (resp.data.metadata.page_count > 1) {
    for (let i = 1; i < resp.data.metadata.page_count; i++) {
      resp = await axios.get(`https://api.datadoghq.com/api/v1/monitor/search?per_page=${per_page}&page=${i}`, {
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": process.env.DD_API_KEY || "",
          "DD-APPLICATION-KEY": process.env.DD_APP_KEY || "",
        },
      });

      monitors.push(...resp.data.monitors)      
    }
  }

  return monitors
}