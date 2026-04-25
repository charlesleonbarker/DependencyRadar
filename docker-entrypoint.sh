#!/bin/sh
set -e

if [ -z "$(ls -A /repos 2>/dev/null)" ]; then
  export DependencyRadar__Roots__0=/fixtures
else
  export DependencyRadar__Roots__0=/repos
fi

exec dotnet DependencyRadar.Service.dll
