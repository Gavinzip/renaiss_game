import type { ClassSwitchRequest, JoinRequest } from "@renaiss-game/shared";
import { useHudStore } from "../../state/hudStore";

interface ArenaRequestHandlers {
  onJoinRequest: (request: JoinRequest) => void;
  onClassSwitchRequest: (request: ClassSwitchRequest) => void;
}

export function subscribeToArenaRequests(handlers: ArenaRequestHandlers) {
  const unsubscribe = useHudStore.subscribe((state, previous) => {
    if (state.joinRequest && state.joinRequest !== previous.joinRequest) {
      handlers.onJoinRequest(state.joinRequest);
    }
    if (state.classSwitchRequest && state.classSwitchRequest !== previous.classSwitchRequest) {
      handlers.onClassSwitchRequest(state.classSwitchRequest);
    }
  });

  const pendingJoinRequest = useHudStore.getState().joinRequest;
  if (pendingJoinRequest) {
    handlers.onJoinRequest(pendingJoinRequest);
  }

  return unsubscribe;
}
