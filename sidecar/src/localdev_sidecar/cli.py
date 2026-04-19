from .server import SidecarServer


def main() -> int:
    server = SidecarServer()
    return server.run_stdio()


if __name__ == "__main__":
    raise SystemExit(main())
