import api from "./axios";

export interface SignUpRequest {
  username: string;
  email: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export const signUp = async (data: SignUpRequest) => {
  const response = await api.post("/auth/signUp", data);

  return response.data;
};

export const signIn = async (data: SignInRequest) => {
  const response = await api.post("/auth/signIn", data);

  return response.data;
};

export async function getCurrentUser() {
  const response = await api.get("/auth/me");

  return response.data;
}