import socket, ssl, os, struct

HOST, PORT = "10.215.189.15", 5349
ctx = ssl.create_default_context(cafile="/home/harshit/CrowdStream/haproxy.crt")
s = ctx.wrap_socket(socket.create_connection((HOST, PORT), 5), server_hostname=HOST)
s.settimeout(5)
print("TLS ok:", s.version(), s.getpeercert()["subject"])

def send(msg_type, attrs=b""):
    hdr = struct.pack("!HHI", msg_type, len(attrs), 0x2112A442) + os.urandom(12)
    s.sendall(hdr + attrs)
    r = s.recv(4096)
    return struct.unpack("!H", r[:2])[0], r

t, _ = send(0x0001)
print("Binding response:", hex(t), "(0x101 = success)")

alloc = struct.pack("!HH", 0x0019, 4) + bytes([17, 0, 0, 0])
t, r = send(0x0003, alloc)
print("Allocate response:", hex(t), "(0x113 = error, expected 401 without auth)")
i = 20
while i + 4 <= len(r):
    at, al = struct.unpack("!HH", r[i:i+4])
    if at == 0x0009:
        print("Error code:", r[i+6] * 100 + r[i+7])
    i += 4 + al + (-al % 4)
