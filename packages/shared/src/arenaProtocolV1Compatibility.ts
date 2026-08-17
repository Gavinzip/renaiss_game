import type {
  ClassSwitchRequest as RuntimeClassSwitchRequest,
  GameSnapshot as RuntimeGameSnapshot,
  JoinAccepted as RuntimeJoinAccepted,
  PlayerInput as RuntimePlayerInput,
  JoinRequest as RuntimeJoinRequest
} from "./types";
import type {
  ClassSwitchRequest as SchemaClassSwitchRequest,
  GameSnapshot as SchemaGameSnapshot,
  JoinAccepted as SchemaJoinAccepted,
  JoinRequest as SchemaJoinRequest,
  PlayerInput as SchemaPlayerInput
} from "./generated/arenaProtocolV1";

type Assert<T extends true> = T;

type _SnapshotSchemaCoversRuntime = Assert<SchemaGameSnapshot extends RuntimeGameSnapshot ? true : false>;
type _SnapshotRuntimeCoversSchema = Assert<RuntimeGameSnapshot extends SchemaGameSnapshot ? true : false>;
type _InputSchemaCoversRuntime = Assert<SchemaPlayerInput extends RuntimePlayerInput ? true : false>;
type _InputRuntimeCoversSchema = Assert<RuntimePlayerInput extends SchemaPlayerInput ? true : false>;
type _SwitchSchemaCoversRuntime = Assert<SchemaClassSwitchRequest extends RuntimeClassSwitchRequest ? true : false>;
type _SwitchRuntimeCoversSchema = Assert<RuntimeClassSwitchRequest extends SchemaClassSwitchRequest ? true : false>;
type _JoinAcceptedSchemaCoversRuntime = Assert<SchemaJoinAccepted extends RuntimeJoinAccepted ? true : false>;
type _JoinAcceptedRuntimeCoversSchema = Assert<RuntimeJoinAccepted extends SchemaJoinAccepted ? true : false>;
type _JoinRequestSchemaCoversRuntime = Assert<SchemaJoinRequest extends RuntimeJoinRequest ? true : false>;
type _JoinRequestRuntimeCoversSchema = Assert<RuntimeJoinRequest extends SchemaJoinRequest ? true : false>;

export {};
