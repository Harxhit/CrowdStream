import api from "../api/axios"; 

export async function getIceServers() {
  const response = await api.get("/turn/credentials");

  const { username, credential } = response.data.data;

  return [
    {
      urls: [
        import.meta.env.VITE_TURN_UDP_URL,
        import.meta.env.VITE_TURN_TCP_URL,
        import.meta.env.VITE_TURNS_TCP_URL,
      ],
      username,
      credential,
    },
  ];
}