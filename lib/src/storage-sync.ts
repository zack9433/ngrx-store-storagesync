import { merge } from 'lodash';

import { IStorageSyncConfig } from './models/storage-sync-config';

export const dateReviver = (key: string, value: any) => {
  const isDateString =
    typeof value === 'string' && /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.test(value);
  return isDateString ? new Date(value) : value;
};

export const filterObject = (obj: Object, keys?: string[]): Object => {
  if (!keys) {
    return obj;
  }
  let index = 0;
  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      switch (typeof obj[prop]) {
        case 'string':
          index = keys.indexOf(prop);
          if (index > -1) {
            delete obj[prop];
          }
          break;
        case 'object':
          index = keys.indexOf(prop);
          if (index > -1) {
            delete obj[prop];
          } else {
            filterObject(obj[prop], keys);
          }
          break;
        default: {
          if (keys.includes(prop)) {
            delete obj[prop];
          }
        }
      }
    }
  }
  return obj;
};

export const rehydrateApplicationState = (
  keys: string[],
  { restoreDates, storage, storageKeySerializer }: IStorageSyncConfig
): Object => {
  const reviver = restoreDates ? dateReviver : (k: string, v: any) => v;
  return keys.reduce((acc, curr) => {
    const state = storage.getItem(storageKeySerializer(curr));
    return state
      ? {
          ...acc,
          ...{
            [curr]: JSON.parse(storage.getItem(storageKeySerializer(curr)), reviver)
          }
        }
      : acc;
  }, {});
};

export const syncStateUpdate = (
  state: any,
  { features, storage, storageKeySerializer }: IStorageSyncConfig
): void => {
  features.forEach(feature => {
    const featureState = JSON.parse(JSON.stringify(state[feature.stateKey]));
    const filteredState = filterObject(featureState, feature.ignoreKeys);
    storage.setItem(storageKeySerializer(feature.stateKey), JSON.stringify(filteredState));
  });
};

export const storageSync = (cfg: IStorageSyncConfig) => (reducer: any) => {
  const INIT_ACTION = '@ngrx/store/init';
  const UPDATE_ACTION = '@ngrx/store/update-reducers';

  const config: IStorageSyncConfig = {
    rehydrate: true,
    restoreDates: true,
    storageKeySerializer: (key: string) => key,
    ...cfg
  };

  const stateKeys = config.features.map(({ stateKey }) => stateKey);
  const rehydratedState = config.rehydrate ? rehydrateApplicationState(stateKeys, config) : null;

  return (state: any, action: any) => {
    let nextState = null;

    if (action.type === INIT_ACTION && !state) {
      nextState = reducer(state, action);
    } else {
      nextState = { ...state };
    }

    if ((action.type === INIT_ACTION || action.type === UPDATE_ACTION) && rehydratedState) {
      nextState = merge({}, nextState, rehydratedState);
    }

    nextState = reducer(nextState, action);

    if (action.type !== INIT_ACTION) {
      syncStateUpdate(nextState, config);
    }

    return nextState;
  };
};
