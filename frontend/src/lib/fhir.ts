const DEFAULT_CLOUD_API_URL = "https://niraiva.onrender.com";
const LOCAL_API_URL = "http://localhost:5000";

export const getApiBaseUrl = () => {
    // Check if we are running on localhost
    const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "::1";

    const envUrl = import.meta.env.VITE_API_BASE_URL;

    // If on localhost, default to local backend unless env explicitly overrides
    if (isLocalhost) {
        return LOCAL_API_URL;
    }

    let url = envUrl || DEFAULT_CLOUD_API_URL;
    return url.replace(/\/+$/, "");
};

const buildEndpoint = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getApiBaseUrl()}${normalizedPath}`;
};

const withAuthHeaders = (token: string, extra?: HeadersInit): HeadersInit => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/fhir+json",
    ...extra,
});

const handleResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            text || `FHIR request failed with status ${response.status}`
        );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("json")) {
        return (await response.json()) as T;
    }

    // For non-JSON payloads, return raw text as best effort.
    return await response.text() as T;
};

export const fetchFhirResource = async <T>(
    resourcePath: string,
    token: string,
    init?: RequestInit
): Promise<T> => {
    const response = await fetch(buildEndpoint(resourcePath), {
        ...init,
        headers: withAuthHeaders(
            token,
            init?.headers as HeadersInit | undefined
        ),
    });

    return handleResponse<T>(response);
};

export const getPatients = async <T = any>(
    token: string,
    queryParams?: Record<string, string | string[]>
) => {
    const url = new URL(buildEndpoint("/fhir/patient"));
    if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((entry) => url.searchParams.append(key, entry));
            } else {
                url.searchParams.append(key, value);
            }
        });
    }
    const response = await fetch(url.toString(), {
        headers: withAuthHeaders(token),
    });
    return handleResponse<T>(response);
};

export type FhirBundle<T = any> = {
    resourceType: "Bundle";
    total?: number;
    entry?: Array<{
        fullUrl?: string;
        resource?: T;
    }>;
};

export type FhirPatientName = {
    family?: string;
    given?: string[];
    text?: string;
};

export type FhirPatient = {
    resourceType: "Patient";
    id?: string;
    name?: FhirPatientName[];
    gender?: string;
    birthDate?: string;
};

