import socket, ssl, os, struct, hmac, hashlib, base64, time

HOST, PORT = "10.215.189.15", 5349
SECRET = os.environ["SECRET"].encode()
ctx = ssl.create_default_context(cafile=os.environ["CA"])
s = ctx.wrap_socket(socket.create_connection((HOST, PORT), 5), server_hostname=HOST)
s.settimeout(5)
print("TLS ok")

def attr(t, v):
    return struct.pack("!HH", t, len(v)) + v + b"\0" * (-len(v) % 4)

def request(attrs, key=None):
    body = attrs
    txid = os.urandom(12)
    if key:
        hdr = struct.pack("!HHI", 3, len(body) + 24, 0x2112A442) + txid
        body += attr(0x0008, hmac.new(key, hdr + body, hashlib.sha1).digest())
    s.sendall(struct.pack("!HHI", 3, len(body), 0x2112A442) + txid + body)
    h = s.recv(20)
    mt, ml = struct.unpack("!HH", h[:4])
    data = b""
    while len(data) < ml:
        data += s.recv(ml - len(data))
    out, i = {}, 0
    while i + 4 <= len(data):
        at, al = struct.unpack("!HH", data[i:i+4])
        out[at] = data[i+4:i+4+al]
        i += 4 + al + (-al % 4)
    return mt, out

base = attr(0x0019, bytes([17, 0, 0, 0]))
mt, a = request(base)
realm, nonce = a[0x0014], a[0x0015]
user = f"{int(time.time()) + 3600}:test".encode()
pw = base64.b64encode(hmac.new(SECRET, user, hashlib.sha1).digest())
key = hashlib.md5(user + b":" + realm + b":" + pw).digest()
attrs = base + attr(0x0006, user) + attr(0x0014, realm) + attr(0x0015, nonce)
mt, a = request(attrs, key)

if mt == 0x0103:
    v = a[0x0016]
    port = struct.unpack("!H", v[2:4])[0] ^ 0x2112
    ip = ".".join(str(b ^ m) for b, m in zip(v[4:8], bytes.fromhex("2112A442")))
    print("ALLOCATED relay", ip, port)
else:
    e = a.get(0x0009, b"\0\0\0\0")
    print("FAILED", hex(mt), e[2] * 100 + e[3], e[4:].decode(errors="ignore"))

