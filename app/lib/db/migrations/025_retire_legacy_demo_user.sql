-- The shared legacy demo account predates isolated demo sandboxes. Its data is
-- disposable demo content; deleting the user cascades through all owned data,
-- tokens, and group assignments while leaving real and sandbox users untouched.
delete from users where id = 'legacy-user';
