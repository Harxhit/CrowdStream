export type AckResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      code: string;
    };