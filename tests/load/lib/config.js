export const BASE_URL = __ENV.BASE_URL || "http://localhost:3001/api/v1";

export const TEST_USER = {
  email: __ENV.TEST_EMAIL || "admin@agentepro.local",
  password: __ENV.TEST_PASSWORD || "Admin@123456",
};

export const thresholds = {
  leads: {
    http_req_duration: ["p(95)<200"],
    http_req_failed: ["rate<0.01"],
  },
  agentActivate: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.05"],
  },
  hitlApprove: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};
