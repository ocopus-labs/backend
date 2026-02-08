export interface OrderingSettings {
  selfOrderEnabled: boolean;
  requirePrepayment: boolean;
}

export const DEFAULT_ORDERING_SETTINGS: OrderingSettings = {
  selfOrderEnabled: false,
  requirePrepayment: false,
};
