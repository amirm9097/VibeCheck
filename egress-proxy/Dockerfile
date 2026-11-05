FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/proxy
COPY proxy.py ./proxy.py
USER 65532:65532
EXPOSE 8888
HEALTHCHECK --interval=20s --timeout=3s --retries=3 CMD python -c "import socket; s=socket.create_connection(('127.0.0.1',8888),2); s.close()" || exit 1
CMD ["python", "proxy.py"]
