#!/usr/bin/env python3
"""Run once to create the initial admin user in the database."""
import os
import sys
import bcrypt as _bcrypt

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass

from models import Base, SessionLocal, User, engine

Base.metadata.create_all(bind=engine)

username = os.getenv("ADMIN_USERNAME") or input("Username: ")
password = os.getenv("ADMIN_PASSWORD") or input("Password: ")

hashed = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

with SessionLocal() as db:
    if db.query(User).filter(User.username == username).first():
        print(f"User '{username}' already exists.")
        sys.exit(0)
    db.add(User(
        username=username,
        hashed_password=hashed,
        is_admin=True,
        is_approver=True,
    ))
    db.commit()
    print(f"Admin user '{username}' created.")
