import { useSensor, useSensors, PointerSensor, TouchSensor, MouseSensor } from '@dnd-kit/core';

/**
 * Use MouseSensor + TouchSensor instead of PointerSensor.
 * TouchSensor with a delay lets the user scroll naturally —
 * a drag only activates if they hold still for 250ms or move 5px.
 */
export function useDndSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,       // ms hold before drag activates
        tolerance: 5,     // px movement allowed during delay
      },
    })
  );
}
