FROM nginx:1.31.2-alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY config/ etc/nginx/conf.d


EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]