.PHONY: up down seed migrate dev

up:
	docker-compose up -d

down:
	docker-compose down

seed:
	npm run seed

migrate:
	npx prisma migrate deploy

dev:
	npm run dev
