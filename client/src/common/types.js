import { isEphemeralAgentId } from 'librechat-data-provider';
export function isEphemeralAgent(agentId) {
    return isEphemeralAgentId(agentId);
}
export var PromptsEditorMode;
(function (PromptsEditorMode) {
    PromptsEditorMode["SIMPLE"] = "simple";
    PromptsEditorMode["ADVANCED"] = "advanced";
})(PromptsEditorMode || (PromptsEditorMode = {}));
export var STTEndpoints;
(function (STTEndpoints) {
    STTEndpoints["browser"] = "browser";
    STTEndpoints["external"] = "external";
})(STTEndpoints || (STTEndpoints = {}));
export var TTSEndpoints;
(function (TTSEndpoints) {
    TTSEndpoints["browser"] = "browser";
    TTSEndpoints["external"] = "external";
})(TTSEndpoints || (TTSEndpoints = {}));
export const mainTextareaId = 'prompt-textarea';
export const globalAudioId = 'global-audio';
export var IconContext;
(function (IconContext) {
    IconContext["landing"] = "landing";
    IconContext["menuItem"] = "menu-item";
    IconContext["nav"] = "nav";
    IconContext["message"] = "message";
})(IconContext || (IconContext = {}));
export var Panel;
(function (Panel) {
    Panel["advanced"] = "advanced";
    Panel["builder"] = "builder";
    Panel["actions"] = "actions";
    Panel["model"] = "model";
    Panel["version"] = "version";
})(Panel || (Panel = {}));
export const defaultDebouncedDelay = 450;
export var ESide;
(function (ESide) {
    ESide["Top"] = "top";
    ESide["Right"] = "right";
    ESide["Bottom"] = "bottom";
    ESide["Left"] = "left";
})(ESide || (ESide = {}));
export var NotificationSeverity;
(function (NotificationSeverity) {
    NotificationSeverity["INFO"] = "info";
    NotificationSeverity["SUCCESS"] = "success";
    NotificationSeverity["WARNING"] = "warning";
    NotificationSeverity["ERROR"] = "error";
})(NotificationSeverity || (NotificationSeverity = {}));
