import type { FrontendBroadcaster, FrontendViewer } from "./types/room.types";

class Room {
  id: string;

  broadcasters = new Map<string, FrontendBroadcaster>();
  viewers = new Map<string, FrontendViewer>();

  constructor(id: string) {
    this.id = id;
  }
}

export default Room;