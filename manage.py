#!/usr/bin/env python
"""Comandos de desenvolvimento do Agata, via CLI nativa do Vela."""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from vela.cli.commands import CommandRunner


if __name__ == "__main__":
    CommandRunner().execute(sys.argv[1:])
