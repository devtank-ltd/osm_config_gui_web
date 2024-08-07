#!/usr/bin/env python3

import sys
import logging
import time
import socket
import subprocess
import random
import string
import os
import signal
import ssl

from aiohttp import web
import asyncio

event_loop =  asyncio.new_event_loop()
tcpsockets = []
all_processes = {}

PATH = os.path.dirname(os.path.abspath(__file__))

_RESPONSE_BEGIN = b"============{"
_RESPONSE_END = b"}============"

WEBROOT = "./webroot"

import atexit

def exit_handler():
    logging.critical('My application is ending!')
    for tcp in tcpsockets:
        logging.critical(tcp.close())

atexit.register(exit_handler)


class virtual_osm:
    def __init__(self, port, logger):
        self.port = port
        self._logger = logger

    def gen_virtual_osm_instance(self):
        rstr = self._random_str()
        self.loc = f"/tmp/osm_{rstr}/"

        linux_elf = f"{PATH}/firmware.elf"

        if os.path.exists(linux_elf):
            cmd = [f"DEBUG=1 OSM_LOC={self.loc} USE_PORT={self.port} {linux_elf}"]
            self._spawn_virtual_osm(cmd, self.port)
            time.sleep(2)
        else:
            self._logger.debug("Virtual OSM could not be found.")

        return self.port

    @staticmethod
    def _random_str():
        length = 20
        letters = string.ascii_lowercase
        return ''.join(random.choice(letters) for i in range(length))

    def _spawn_virtual_osm(self, cmd, port):
        self.vosm_subp = subprocess.Popen(cmd, stdout=subprocess.PIPE, shell=True)
        all_processes[port] = self.vosm_subp
        return self.vosm_subp


class osm_tcp_client:
    def __init__(self, port, host, logger):
        self.port = port
        self.host = host
        self._logger = logger

    def osm_svr(self):
        self.osm = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            self.osm.connect((self.host, self.port))
        except ConnectionRefusedError:
            return False
        return self.osm

    def write(self, msg):
        self.osm.sendall((f"{msg}\n").encode())

    def readlines(self, timeout=8):
        now = time.monotonic()
        end_time = now + timeout
        new_msg = None
        msgs = b""
        while now < end_time:
            new_msg = self.osm.recv(1024)
            if new_msg is None:
                self._logger.debug("NULL line read, probably closed")
                break
            msgs += new_msg
            if _RESPONSE_END in msgs:
                break
            now = time.monotonic()
        return msgs.decode()

    def do_cmd(self, cmd):
        self.write(cmd)
        ret = self.readlines()
        return ret

    def close(self):
        self.osm.close()
        self._logger.debug("TCP socket closed.")

class http_server:
    def __init__(self, port, is_verbose, host, ssl_context=None, logger=None):
        self.port = port
        self.host = host
        self.ssl_context = ssl_context
        if logger is None:
            logger = logging.getLogger(__name__)
            self._logger = logger
            if is_verbose:
                logging.basicConfig(level=logging.DEBUG)
        self._logger.info(f"Running on {self.host} on port {self.port}")

    @staticmethod
    def gen_random_port():
        port = random.randint(1096, 65535)
        return port

    def run_server(self):
        app = web.Application()
        app.add_routes([web.get('/', self.get_index),
                        web.get('/websocket', self.spawn_osm)
                        ])
        app.router.add_static('/', path=(WEBROOT),
                      name='app', show_index=True)
        runner = web.AppRunner(app)
        event_loop.run_until_complete(runner.setup())
        site = web.TCPSite(runner, port=self.port, ssl_context=self.ssl_context)
        event_loop.run_until_complete(site.start())
        event_loop.run_forever()


    async def spawn_osm(self, request):
        port = self.gen_random_port()

        vosm = virtual_osm(port, self._logger)
        osm = vosm.gen_virtual_osm_instance()

        ws = web.WebSocketResponse()
        await ws.prepare(request)

        tcp_client = osm_tcp_client(osm, self.host, self._logger)
        svr = tcp_client.osm_svr()
        if not svr:
            return False
        tcpsockets.append(svr)

        async for msg in ws:
            if msg.type == web.WSMsgType.CLOSE:
                self._logger.debug("It's over!")
                break
            elif msg.type == web.WSMsgType.TEXT:
                if msg.data == "close\n":
                    break
                else:
                    output = tcp_client.do_cmd(msg.data)
                    await ws.send_str(output)
            elif msg.type == web.WSMsgType.ERROR:
                self.close_socket(port, tcp_client)
                self._logger.debug('ws connection closed with exception %s' %
                    ws.exception())

        self.close_socket(port, tcp_client)
        await ws.close()
        return ws

    def close_socket(self, port, client):
        client.close()
        process = all_processes[port]
        fw_pid = int(process.pid)
        bash_pid = fw_pid + 1
        os.kill(bash_pid, signal.SIGINT)
        status = os.wait()
        self._logger.debug(f"Process terminated with pid {status[0]}")
        return status

    async def get_index(self, request):
        return web.FileResponse(os.path.join(WEBROOT, 'index.html'))

def main():
    import argparse

    def get_args():
        parser = argparse.ArgumentParser(description="OSM Config GUI Server")
        parser.add_argument("-p", "--port"      , help="Serial Port"                    , required=False, type=int                  , default=8000          )
        parser.add_argument("-v", "--verbose"   , help="Verbose messages"               , action="store_true"                                               )
        parser.add_argument("-H", "--host"      , help="Host url"                       , type=str                                  , default='127.0.0.1'   )
        parser.add_argument("-s", "--ssl"       , help="Enable SSL"                     , action="store_true"                                               )
        parser.add_argument("--key"             , help="SSL Key path"                   , type=str                                  , default="key.pem"     )
        parser.add_argument("--cert"            , help="SSL Cert path"                  , type=str                                  , default="cert.pem"    )
        return parser.parse_args()

    args = get_args()
    ssl_context = None
    if args.ssl:
        ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ssl_context.load_cert_chain(args.cert, args.key)

    svr = http_server(args.port, args.verbose, args.host, ssl_context=ssl_context)
    svr.run_server()

    return 0

if __name__ == "__main__":
    sys.exit(main())
