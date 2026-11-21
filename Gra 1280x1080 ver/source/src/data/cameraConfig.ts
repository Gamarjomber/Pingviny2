export interface CameraConfig {
  followLerp: number; // 1/с
  cursorLook: number; // доля відстані до курсора, на яку камера «тягнеться»
  cursorLookMax: number; // px
  zoomLerp: number;
  /** Чим довший відряд, тим далі камера. Сходинки, щоб піксель не плив. */
  zoomSteps: { fromUnits: number; zoom: number }[];
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  followLerp: 7,
  cursorLook: 0.18,
  cursorLookMax: 60,
  zoomLerp: 3,
  zoomSteps: [
    // zoom = екранних пікселів на одиницю світу; кратний ART_PX_PER_WORLD (3) → піксель арту = ціле число екранних
    { fromUnits: 0, zoom: 6 },
    { fromUnits: 12, zoom: 3 },
  ],
};
