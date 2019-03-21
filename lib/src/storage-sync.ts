import { Action } from '@ngrx/store';
import { merge } from 'lodash';

import { INIT_ACTION, UPDATE_ACTION } from './actions';
import { IStorageSyncOptions } from './models/storage-sync-options';
import { rehydrateState } from './rehydrate-state';
import { stateSync } from './state-sync';

export const storageSync = <T>(options: IStorageSyncOptions) => (
  reducer: (state: T, action: Action) => T
): ((state: T, action: Action) => T) => {
  const config: IStorageSyncOptions = {
    rehydrate: true,
    syncEmptyObjects: false,
    storageKeySerializer: (key: string) => key,
    rehydrateStateMerger: (nextState, rehydratedState) => merge({}, nextState, rehydratedState),
    ...options
  };

  const restoredState = config.rehydrate ? rehydrateState<T>(config) : null;

  return (state: T, action: Action): T => {
    let nextState: T = null;

    if (action.type === INIT_ACTION && !state) {
      nextState = reducer(state, action);
    } else {
      nextState = { ...state };
    }

    if (restoredState && [INIT_ACTION, UPDATE_ACTION].includes(action.type)) {
      nextState = config.rehydrateStateMerger(nextState, restoredState);
    }

    nextState = reducer(nextState, action);

    if (action.type !== INIT_ACTION) {
      stateSync(nextState, config);
    }

    return nextState;
  };
};
