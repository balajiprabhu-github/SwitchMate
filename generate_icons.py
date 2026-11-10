import zlib
import struct

def create_png(width, height, r, g, b, accent_r, accent_g, accent_b, filename):
    # Generates a PNG icon with a rounded badge and target/focus symbol
    raw_data = bytearray()
    cx, cy = width / 2.0, height / 2.0
    radius = width * 0.46
    inner_radius = width * 0.28
    dot_radius = width * 0.12

    for y in range(height):
        raw_data.append(0) # Filter byte: None
        for x in range(width):
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5

            if dist > radius:
                # Transparent outside
                raw_data.extend([0, 0, 0, 0])
            elif dist > radius - 1.5:
                # Anti-aliasing edge
                alpha = int(255 * (radius - dist) / 1.5)
                raw_data.extend([r, g, b, max(0, min(255, alpha))])
            else:
                # Inside base circle
                # Draw concentric target / focus ring
                in_ring = (dist <= inner_radius + 1.5 and dist >= inner_radius - 2.0)
                in_dot = (dist <= dot_radius)
                
                # Check for crosshair lines
                is_crosshair = False
                if (abs(dx) <= width * 0.04 and dist <= inner_radius + width * 0.12 and dist >= dot_radius) or \
                   (abs(dy) <= width * 0.04 and dist <= inner_radius + width * 0.12 and dist >= dot_radius):
                    is_crosshair = True

                if in_dot or in_ring or is_crosshair:
                    raw_data.extend([accent_r, accent_g, accent_b, 255])
                else:
                    raw_data.extend([r, g, b, 255])

    def chunk(tag, data):
        return struct.pack("!I", len(data)) + tag + data + struct.pack("!I", zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack("!IIBBBBB", width, height, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(bytes(raw_data)))
    iend = chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(header + ihdr + idat + iend)

# Navy blue background (#1E293B) with bright Emerald green accent (#10B981)
create_png(16, 16, 30, 41, 59, 16, 185, 129, 'icons/icon16.png')
create_png(48, 48, 30, 41, 59, 16, 185, 129, 'icons/icon48.png')
create_png(128, 128, 30, 41, 59, 16, 185, 129, 'icons/icon128.png')
print("Icons generated successfully.")
