"""Custom exceptions for MongoDB CRUD operations."""


class VersionConflictError(Exception):
    """Raised when document version does not match expected version during update.

    This indicates another client has modified the document since it was read,
    preventing data clobbering via optimistic concurrency control.
    """

    def __init__(
        self,
        document_id: str,
        expected_version: int,
        message: str = "Document has been modified by another session",
    ):
        self.document_id = document_id
        self.expected_version = expected_version
        self.message = message
        super().__init__(self.message)
