import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { PbsApiToolArgs } from "../schemas.js";

let apiClient: AxiosInstance | null = null;
let cachedSubscriptionKey: string | null = null;
let cachedBaseUrl: string | null = null;

function getApiClient(subscriptionKey?: string, baseUrl?: string): AxiosInstance {
  const key = subscriptionKey || process.env.PBS_API_SUBSCRIPTION_KEY;
  const url = baseUrl || process.env.PBS_API_BASE_URL || "https://data-api.health.gov.au/pbs/api/v3";
  
  if (!key) {
    throw new Error("PBS API subscription key is required. Set PBS_API_SUBSCRIPTION_KEY environment variable or provide subscriptionKey parameter.");
  }
  
  // Create new client if config changed or first time
  if (!apiClient || cachedSubscriptionKey !== key || cachedBaseUrl !== url) {
    apiClient = axios.create({
      baseURL: url,
      headers: {
        "Subscription-Key": key,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      timeout: 30000
    });
    cachedSubscriptionKey = key;
    cachedBaseUrl = url;
  }
  
  return apiClient;
}

export async function pbsApiToolHandler(args: PbsApiToolArgs) {
  const client = getApiClient(args.subscriptionKey);
  const config: AxiosRequestConfig = {
    method: args.method,
    url: args.endpoint,
    params: args.method === "GET" ? args.params : undefined,
    data: args.method === "POST" ? args.params : undefined,
    timeout: args.timeout
  };
  
  try {
    const response = await client.request(config);
    return {
      success: true,
      data: response.data,
      status: response.status,
      headers: response.headers
    };
  } catch (error: any) {
    if (error.response) {
      return {
        success: false,
        error: {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          message: `PBS API Error: ${error.response.status} ${error.response.statusText}`
        }
      };
    } else if (error.request) {
      return {
        success: false,
        error: {
          message: "Network error: No response from PBS API",
          code: error.code
        }
      };
    } else {
      return {
        success: false,
        error: {
          message: `Request setup error: ${error.message}`
        }
      };
    }
  }
}