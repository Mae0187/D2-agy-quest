/**
 * Coordinate transforms for the background map, in one place and testable.
 *
 *     node tools/check_coords.js                 # verify
 *     node tools/check_coords.js --trace act1    # print every intermediate
 *
 * This exists because the same arithmetic was got wrong three times in a row -
 * the vertical axis divided by the horizontal scale, then a zoom applied twice,
 * then a fixed window that put the world origin in the canvas corner and the
 * character off-screen. Each time the fix was "change it and look", which finds
 * one bug and hides the next.
 *
 * The trouble was four coordinate spaces with no statement of how they relate:
 *
 *   world        what the simulation uses. The projection is fixed:
 *                  screenX = (worldX - worldY) * 26
 *                  screenY = (worldX + worldY) * 13
 *   image        pixels of the background PNG. Its own scale, from the map's
 *                geometry file: `pixelsPerUnit` may be 26x13 or 7.8x3.9.
 *   screen       what the drawing calls use: `worldToScreen(world)`.
 *   canvas       screen plus the origin offset.
 *
 * Written down, the relationships are short:
 *
 *   image   = originInImage + projection(world) / engineScale * imageScale
 *   screen  = projection(world)
 *   canvas  = screen + origin
 *
 * and for the background, which is drawn as an image rather than projected:
 *
 *   the image's pixel (0,0) belongs at  canvas = origin - originInImage * zoom
 *
 * A scene is fixed, so `origin` is chosen once to put the image where it
 * should be and then never moves.
 */

export const HALF_TILE_W = 26;
export const HALF_TILE_H = 13;

/** The projection, spec section 20. No map involved. */
export function project(world) {
  return {
    x: (world.x - world.y) * HALF_TILE_W,
    y: (world.x + world.y) * HALF_TILE_H,
  };
}

/** Image pixels per world unit, for a map at some resolution. */
export function pixelsPerUnit(info) {
  const perUnit = (info && info.pixelsPerUnit) || {};
  return {
    x: perUnit.horizontal || HALF_TILE_W,
    y: perUnit.vertical || HALF_TILE_H,
  };
}

/** The zoom at which a map's pixels line up with the engine's. */
export function nativeZoom(info) {
  return HALF_TILE_W / pixelsPerUnit(info).x;
}

/** World position -> image pixel. */
export function worldToImage(info, world) {
  const perUnit = pixelsPerUnit(info);
  const origin = info.originInImage;
  return {
    x: origin.x + (world.x - world.y) * perUnit.x,
    y: origin.y + (world.x + world.y) * perUnit.y,
  };
}

/** Image pixel -> world position. */
export function imageToWorld(info, pixel) {
  const perUnit = pixelsPerUnit(info);
  const origin = info.originInImage;
  const u = (pixel.x - origin.x) / perUnit.x;
  const v = (pixel.y - origin.y) / perUnit.y;
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

/**
 * Where the image goes on the canvas, and the world origin that implies.
 *
 * `origin` throughout means *the canvas position of world (0, 0)*, because that
 * is what `canvas = origin + project(world)` needs it to mean. Everything below
 * follows from that one statement.
 *
 * The image is drawn with its own pixel `p` at
 *
 *     canvas(p) = origin + (p - originInImage) * zoom
 *
 * which for pixel (0, 0) gives `origin - originInImage * zoom`. And the image
 * is **centred** on the canvas rather than pinned to its corner: a scene is a
 * crop whose landmark sits at the crop's centre, so pinning the corner would
 * put the landmark at the bottom-right of the viewport - off-screen, for a
 * 2560x1440 scene in a 1280x800 window, which is exactly what happened.
 */
export function scenePlacement(info, canvas, zoom) {
  const width = info.size.width * zoom;
  const height = info.size.height * zoom;
  return {
    x: canvas.width / 2 - width / 2,
    y: canvas.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * The world origin that goes with that placement.
 *
 * Inverting `canvas(p) = origin + (p - originInImage) * zoom` at pixel (0, 0)
 * gives `origin = corner + originInImage * zoom`.
 */
export function originForPlacement(info, placement, zoom) {
  return {
    x: placement.x + info.originInImage.x * zoom,
    y: placement.y + info.originInImage.y * zoom,
  };
}

/** Which image pixel is under a canvas point, given a placement. */
export function canvasToImage(info, placement, zoom, point) {
  return {
    x: (point.x - placement.x) / zoom,
    y: (point.y - placement.y) / zoom,
  };
}

/** Where an image pixel lands on the canvas, given a placement. */
export function imageToCanvas(placement, zoom, pixel) {
  return {
    x: placement.x + pixel.x * zoom,
    y: placement.y + pixel.y * zoom,
  };
}
