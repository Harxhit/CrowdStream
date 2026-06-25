export const iceServers = [
{
  urls: [
    import.meta.env.VITE_TURN_UDP_URL,
    import.meta.env.VITE_TURN_TCP_URL,
    import.meta.env.VITE_TURNS_TCP_URL
  ],
  username: import.meta.env.VITE_TURN_USERNAME,
  credential: import.meta.env.VITE_TURN_CREDENTIAL
  }
];