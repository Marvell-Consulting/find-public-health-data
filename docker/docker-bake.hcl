# The four app images the e2e stack runs, built from docker/Dockerfile in one invocation so
# BuildKit runs the shared builder stage once and the per-app builds in parallel. ci.yml's
# build-app-images job; operations builds on its own because e2e does not need it. By hand:
#
#   docker buildx bake -f docker/docker-bake.hcl --load
target "app" {
  name = item.app
  matrix = {
    item = [
      { app = "public-web", target = "web" },
      { app = "internal-web", target = "web" },
      { app = "public-api", target = "api" },
      { app = "internal-api", target = "api" },
    ]
  }
  context    = "."
  dockerfile = "docker/Dockerfile"
  target     = item.target
  args       = { APP = item.app }
  tags       = ["fphd-ci/${item.app}:ci"]
}

group "default" {
  targets = ["public-web", "internal-web", "public-api", "internal-api"]
}
