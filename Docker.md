# Run LocalTrace on an Ubuntu Docker server

Install Docker Engine and the Compose plugin using the [official Ubuntu installation instructions](https://docs.docker.com/engine/install/ubuntu/). Copy this project to your Ubuntu server. Windows `node_modules`, release builds and dist files are not needed: the Docker build installs Linux dependencies, runs unit/integration tests and builds the interface. No Node.js installation on the host is needed.

## Start

From the project directory on Ubuntu:

```sh
cp .env.example .env
nano .env
```

Set PUBLIC_ORIGIN to the exact address you will enter in your browser, with no trailing slash. For example, if your server IP is `192.168.1.50`:

```dotenv
PUBLIC_ORIGIN=http://192.168.1.50:4173
WEB_PORT=4173
BIND_ADDRESS=0.0.0.0
```

Then run:

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f localtrace
```

Open **http://192.168.1.50:4173** from your computer, substituting your server IP. Ctrl+C exits log viewing without stopping the container. Stop the application with `docker compose down`. After updating the source, run `docker compose up -d --build` again.

Use one consistent browser origin: a different hostname, IP, protocol or port is rejected. When changing WEB_PORT, update the port in PUBLIC_ORIGIN too. Changes to .env require `docker compose up -d` to recreate the service. The HTTP LAN version uses random bytes for session IDs without requiring secure-context randomUUID.

## Access and data

Processing now happens on the Ubuntu server. Images/projects are uploaded to that server over the connection. Projects and exports download to the browser computer; there is no server-side project storage, database, volume or autosave. Keep downloaded projects outside the application directory. Closing/reloading a browser tab loses unsaved edits. The image runs as a non-root user with a read-only filesystem and temporary scratch storage. Sharp/VTracer dependencies are installed for the container platform; Electron is absent from the runtime image.

This application has no login. Use the direct HTTP setup on a trusted private network. For internet access, put it behind an HTTPS reverse proxy with authentication. Set BIND_ADDRESS to `127.0.0.1` when the proxy runs on the Ubuntu host; set PUBLIC_ORIGIN to the HTTPS browser origin, such as `https://trace.example.com`. Configure the proxy to preserve that exact Host header and the browser Origin; forwarded host/protocol headers are intentionally not trusted. Serve at the domain root, allow request bodies up to 120 MB, and allow enough upstream time for tracing. A proxy in another container needs appropriate Docker networking rather than host-loopback access.

PDF still opens the browser print dialog and needs popup permission. Verify page size and scaling when saving a PDF. Multiple clients can run worker jobs concurrently; large images may consume substantial CPU and native/WASM memory. Monitor resources and limit access accordingly.

## Health and troubleshooting

### Sharp reports unsupported CPU / v2 microarchitecture

Sharp's prebuilt Linux x64 binaries require newer CPU instructions. An older CPU or VM CPU configuration may not expose them. Reinstalling the same binary or skipping tests does not resolve this. Add this line to `.env`:

```dotenv
LOCALTRACE_DOCKERFILE=Dockerfile.compat
```

Then rebuild:

```sh
docker compose up -d --build
```

`Dockerfile.compat` compiles libvips 8.18.7 and the pinned Sharp version from source, with optional SIMD engines disabled. It keeps PNG/JPEG/WebP/GIF/SVG input support; optional TIFF/HEIF behavior may differ from the prebuilt distribution. Compilation needs extra time, disk space and RAM; libvips compilation is limited to two jobs. It runs the same unit/conversion tests and checks SVG-to-PNG processing in the final image. The original Dockerfile remains the default for CPUs supporting the prebuilt binaries. The compatibility image still needs verification on your server; it has not been run in this Windows environment.

See [Sharp's CPU and source-build requirements](https://sharp.pixelplumbing.com/install/) and [libvips source-build instructions](https://www.libvips.org/install.html). Simply adding Debian Bookworm's libvips package is insufficient for the newer libvips version required by the pinned Sharp package. The compatibility build downloads the matching source and includes its required runtime libraries.

- `docker compose ps` shows container health. `/healthz` is a basic process-liveness endpoint, not an engine-conversion test.
- **Invalid host / same-origin error:** match PUBLIC_ORIGIN exactly to the browser URL and preserve Host at the proxy. Do not use a trailing slash in the setting.
- **Connection refused:** check container logs, published port, server address and network/firewall routing. The container listens on `0.0.0.0:4173`; WEB_PORT controls the host port.
- **Port already allocated:** choose another WEB_PORT and matching PUBLIC_ORIGIN.
- **Build download failure:** the initial image build requires internet access for the base image and npm packages. Reusing a built image needs no runtime internet access.
- **Native dependency error:** rebuild for the server architecture. Do not mount host node_modules over the container installation.

For manual image use:

```sh
docker build -t localtrace:local .
docker run -d --name localtrace --init --restart unless-stopped \
  -p 4173:4173 -e PUBLIC_ORIGIN=http://192.168.1.50:4173 localtrace:local
```

The Dockerfile uses a [multi-stage build](https://docs.docker.com/build/building/multi-stage/) to separate development/build tools from runtime dependencies. Docker image execution must be verified on the Ubuntu host; a Windows browser test is not proof of container compatibility. See Release_Checklist.md for the required conversion/export checks.

Development browser tests can use LOCALTRACE_TEST_PORT to choose a free port without stopping your existing app server (for example, `LOCALTRACE_TEST_PORT=4181 npm run test:web` on Ubuntu).
