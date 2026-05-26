class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);

    Error.captureStackTrace(this, this.constructor);
    this.statusCode = statusCode;
  }
}

export default ApiError;
