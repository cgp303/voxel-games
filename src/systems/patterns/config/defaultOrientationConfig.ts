import { ENTRY } from '../../../data/constants';
import type { OrientationConfig } from './OrientationConfig';

export const defaultOrientationConfig: OrientationConfig = {
    bankGain: ENTRY.bankGain,
    maxBankRad: ENTRY.maxBankRad,
    orientSmooth: ENTRY.orientSmooth,
    dockSmooth: ENTRY.dockSmooth,
    debugForwardArrow: ENTRY.debugForwardArrow,
};
