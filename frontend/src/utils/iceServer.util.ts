import api from "../api/axios"; 

export async function getIceServers() {
  const response = await api.get("/turn/credentials");

  const { username, credential , urls} = response.data.data;

  return [
    { 
      urls, 
      username,
      credential,
    },
    { urls: "stun:stun.l.google.com:19302" }
  ];
}