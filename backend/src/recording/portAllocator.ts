const usedPorts = new Set<number>();
const MIN_PORT = 20000;
const MAX_PORT = 30000;

export const allocatePortPair = (): { audioPort: number; videoPort: number } => {
  const getPort = (): number => {
    let port: number;
    let maxQuery = 10; 
    do {
      if(maxQuery === 0){
        throw new Error('Availaible ports not found')
      }
      port = Math.floor(Math.random() * (MAX_PORT - MIN_PORT) / 2) * 2 + MIN_PORT;
      maxQuery--; 
    } while (usedPorts.has(port));

    usedPorts.add(port);
    return port;
  };
  return { audioPort: getPort(), videoPort: getPort() };
};

export const releasePorts = (...ports: number[]) => {
  ports.forEach((p) => usedPorts.delete(p));
};