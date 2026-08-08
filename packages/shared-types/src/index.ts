/** Types shared between the frontend and backend of Atlas. */

/** Response shape of the backend health check. */
export interface HealthResponse {
  status: 'ok';
  service: string;
}
