import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import {
  decrementPendingRequests,
  incrementPendingRequests,
  pushApiError,
} from "./apiClientState";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  __retryCount?: number;
};

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

function shouldRetry(error: AxiosError) {
  const status = error.response?.status;
  if (!status) return true;
  return status >= 500 || status === 429;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  incrementPendingRequests();

  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    decrementPendingRequests();
    return response;
  },
  async (error: AxiosError) => {
    decrementPendingRequests();

    const config = error.config as RetriableRequestConfig | undefined;
    if (config && shouldRetry(error)) {
      config.__retryCount = config.__retryCount ?? 0;

      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1;
        const delayMs = RETRY_BASE_DELAY_MS * config.__retryCount;
        await wait(delayMs);
        return apiClient(config);
      }
    }

    const fallbackMessage =
      error.response?.statusText ||
      error.message ||
      "Unexpected API error";

    pushApiError({
      message: fallbackMessage,
      statusCode: error.response?.status,
    });

    return Promise.reject(error);
  },
);

export default apiClient;
